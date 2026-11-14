/**
 * Domain-owned quote intake. Bind this project to the client's tracker spreadsheet.
 * Advanced Gmail Service v1 only. No send, trash, delete, or mailbox-modify calls.
 * mail.google.com and gmail.send are excluded from the manifest.
 * IMPORTANT: gmail.compose itself permits sending. Draft-only is a reviewed-code
 * invariant, NOT an OAuth-level no-send guarantee. Label scope is an application
 * filter; gmail.readonly grants mailbox-wide read capability.
 * No passwords, access tokens, service-account keys, or external HTTP calls.
 */
'use strict';
const CONFIG = {
  "prefix": "GREENSCAPE",
  "company": "GreenScape Landscaping LLC",
  "sheetName": "GreenScape Quote Pipeline"
};
const HEADERS = ['id','created_at','customer','request','owner','status','due_on','last_action'];
const BAD_HEADERS = ['id','created_at','errors','payload'];
const STOP_AFTER_MS = 240000; // leave headroom below the 360-second ceiling

function getContext_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty(CONFIG.prefix + '_SHEET_ID');
  const labelName = props.getProperty(CONFIG.prefix + '_INTAKE_LABEL');
  const owner = props.getProperty(CONFIG.prefix + '_OFFICE_LEAD');
  if (!sheetId || !labelName || !owner) throw new Error('Missing prefixed Script Properties. See HANDOFF.md.');
  if (!/^[a-zA-Z0-9_ /-]{1,80}$/.test(labelName)) throw new Error('Invalid intake label name.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId() !== sheetId) throw new Error('Bound spreadsheet does not match configured SHEET_ID.');
  return { props: props, ss: ss, labelName: labelName, owner: owner };
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  const actual = sheet.getRange(1,1,1,headers.length).getValues()[0];
  if (JSON.stringify(actual) !== JSON.stringify(headers) || sheet.getLastColumn() !== headers.length) {
    throw new Error('Schema mismatch: ' + name + '. Refusing to alter existing data.');
  }
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  return sheet;
}

function existingIds_(sheet) {
  return new Set(sheet.getLastRow() < 2 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,1).getDisplayValues().map(function(r) { return r[0]; }));
}

function safeCell_(value) {
  const text = String(value == null ? '' : value);
  return /^(?:\s*[=+@-]|[\t\r\n])/.test(text) ? "'" + text : text;
}

function plainBody_(part) {
  if (part.mimeType === 'text/plain' && part.body && part.body.data) {
    return Utilities.newBlob(Utilities.base64DecodeWebSafe(part.body.data)).getDataAsString('UTF-8');
  }
  const parts = part.parts || [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].filename) continue; // never parse attachments
    const text = plainBody_(parts[i]);
    if (text) return text;
  }
  return '';
}

function parseQuote_(message) {
  const text = plainBody_(message.payload || {});
  if (!text || text.length > 20000) throw new Error('Missing plain-text JSON payload or payload too large.');
  let input;
  try { input = JSON.parse(text); } catch (_) { throw new Error('Invalid JSON intake payload.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected a JSON object.');
  const errors = [];
  ['customer','request','contact','due_on'].forEach(function(key) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 500) errors.push('Missing/invalid ' + key);
  });
  if (typeof input.contact !== 'string' || !/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(input.contact) || /[\r\n]/.test(input.contact)) errors.push('Invalid customer contact');
  const due = String(input.due_on || '');
  const date = new Date(due);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || isNaN(date.getTime()) || date.toISOString().slice(0,10) !== due) errors.push('Invalid due_on; expected YYYY-MM-DD');
  if (errors.length) throw new Error(errors.join('; '));
  return input;
}

function createReplyDraft_(quote, sourceId) {
  const subject = 'Quote request received [' + sourceId + ']';
  const body = 'Hi ' + quote.customer + ',\n\nWe received your request: ' + quote.request + '. Requested date: ' + quote.due_on + '.\nOur office lead will review it and contact you. No appointment is booked.\n\n' + CONFIG.company;
  const mime = [
    'To: ' + quote.contact,
    'Subject: =?UTF-8?B?' + Utilities.base64Encode(subject, Utilities.Charset.UTF_8) + '?=',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '', Utilities.base64Encode(body, Utilities.Charset.UTF_8).match(/.{1,76}/g).join('\r\n')
  ].join('\r\n');
  const raw = Utilities.base64EncodeWebSafe(mime, Utilities.Charset.UTF_8).replace(/=+$/, '');
  return Gmail.Users.Drafts.create({ message: { raw: raw } }, 'me');
}

function runMorningTrigger() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { console.warn('Execution already active; duplicate run blocked.'); return; }
  const started = Date.now();
  const stats = { rows: 0, drafts: 0, quarantined: 0, duplicates: 0 };
  try {
    const ctx = getContext_();
    const sheet = ensureSheet_(ctx.ss, CONFIG.sheetName, HEADERS);
    const bad = ensureSheet_(ctx.ss, 'Quarantine', BAD_HEADERS);
    const ids = existingIds_(sheet);
    const badIds = existingIds_(bad);
    const labels = Gmail.Users.Labels.list('me').labels || [];
    const label = labels.find(function(item) { return item.name === ctx.labelName; });
    if (!label) throw new Error('Intake label does not exist; create it in Gmail before running.');
    let pageToken;
    do {
      const result = Gmail.Users.Messages.list('me', {
        q: 'label:"' + ctx.labelName + '" -in:trash -in:spam',
        labelIds: [label.id], maxResults: 50, pageToken: pageToken
      });
      const messages = result.messages || [];
      for (let i = 0; i < messages.length; i++) {
        if (Date.now() - started > STOP_AFTER_MS) { console.warn('Runtime budget reached; remaining intake waits for next run.'); return; }
        const id = messages[i].id;
        if (ids.has(id) || badIds.has(id)) { stats.duplicates++; continue; }
        const message = Gmail.Users.Messages.get('me', id, { format: 'full' });
        let quote;
        try { quote = parseQuote_(message); }
        catch (error) {
          bad.appendRow([id, new Date().toISOString(), safeCell_(error.message), safeCell_(plainBody_(message.payload || {}).slice(0,20000))]);
          SpreadsheetApp.flush(); badIds.add(id); stats.quarantined++;
          console.warn(JSON.stringify({ id: id, outcome: 'QUARANTINED' }));
          continue;
        }
        // Commit a durable reservation BEFORE the non-transactional Gmail call.
        // Interrupted/ambiguous draft operations require human reconciliation;
        // never retry them automatically and accidentally create a second draft.
        sheet.appendRow([id, new Date().toISOString(), safeCell_(quote.customer), safeCell_(quote.request), safeCell_(ctx.owner), 'DRAFT_PENDING', quote.due_on, 'Reserved; awaiting draft creation']);
        SpreadsheetApp.flush(); ids.add(id); stats.rows++;
        const rowIndex = sheet.getLastRow();
        try {
          const draft = createReplyDraft_(quote, id);
          sheet.getRange(rowIndex,6).setValue('DRAFT_READY');
          sheet.getRange(rowIndex,8).setValue('draft_id:' + draft.id);
          SpreadsheetApp.flush(); stats.drafts++;
          console.log(JSON.stringify({ id: id, outcome: 'DRAFT_READY' }));
        } catch (error) {
          sheet.getRange(rowIndex,6).setValue('REVIEW_REQUIRED');
          sheet.getRange(rowIndex,8).setValue('Draft outcome uncertain. Check Gmail before manual recovery.');
          SpreadsheetApp.flush();
          throw new Error('Draft operation failed or quota exceeded. Office lead reconciliation required.');
        }
      }
      pageToken = result.nextPageToken;
    } while (pageToken);
  } catch (error) {
    console.error('Trigger failed: ' + String(error.message).slice(0,180));
    throw error;
  } finally {
    console.log(JSON.stringify({ runtime_ms: Date.now()-started, stats: stats }));
    lock.releaseLock();
  }
}

function installMorningTrigger() {
  const ctx = getContext_();
  const sheet = ensureSheet_(ctx.ss, CONFIG.sheetName, HEADERS);
  ensureSheet_(ctx.ss, 'Quarantine', BAD_HEADERS);
  // Owner and trigger creator retain access. Remove unneeded editor/domain access.
  [sheet.getRange('1:1'), sheet.getRange('A:A')].forEach(function(range) {
    if (sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(function(p) { return p.getRange().getA1Notation() === range.getA1Notation(); })) return;
    const protection = range.protect().setDescription('WorkspaceGap protected schema');
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
  });
  ScriptApp.getProjectTriggers().filter(function(t) { return t.getHandlerFunction() === 'runMorningTrigger'; }).forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('runMorningTrigger').timeBased().atHour(8).nearMinute(0).everyDays(1).inTimezone(Session.getScriptTimeZone()).create();
}
