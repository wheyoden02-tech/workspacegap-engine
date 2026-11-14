import { clientPrefix, type ClientConfig } from "./client-config.ts";

export const allowedScopes = [
  "https://www.googleapis.com/auth/spreadsheets.currentonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/script.scriptapp",
] as const;
export const fileNames = [
  "Code.gs",
  "appsscript.json",
  "CLAUDE.md",
  "HANDOFF.md",
] as const;
export type PackageFiles = Record<(typeof fileNames)[number], string>;

export function generatePackage(config: ClientConfig): PackageFiles {
  const prefix = clientPrefix(config);
  const settings = JSON.stringify(
    { prefix, company: config.companyType, sheetName: config.sheetName },
    null,
    2,
  );
  const code = `/**
 * Domain-owned quote intake. Bind this project to the client's tracker spreadsheet.
 * Advanced Gmail Service v1 only. No send, trash, delete, or mailbox-modify calls.
 * mail.google.com and gmail.send are excluded from the manifest.
 * IMPORTANT: gmail.compose itself permits sending. Draft-only is a reviewed-code
 * invariant, NOT an OAuth-level no-send guarantee. Label scope is an application
 * filter; gmail.readonly grants mailbox-wide read capability.
 * No passwords, access tokens, service-account keys, or external HTTP calls.
 */
'use strict';
const CONFIG = ${settings};
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
  return /^(?:\\s*[=+@-]|[\\t\\r\\n])/.test(text) ? "'" + text : text;
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
  if (typeof input.contact !== 'string' || !/^[^\\s@<>;,]+@[^\\s@<>;,]+\\.[^\\s@<>;,]+$/.test(input.contact) || /[\\r\\n]/.test(input.contact)) errors.push('Invalid customer contact');
  const due = String(input.due_on || '');
  const date = new Date(due);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(due) || isNaN(date.getTime()) || date.toISOString().slice(0,10) !== due) errors.push('Invalid due_on; expected YYYY-MM-DD');
  if (errors.length) throw new Error(errors.join('; '));
  return input;
}

function createReplyDraft_(quote, sourceId) {
  const subject = 'Quote request received [' + sourceId + ']';
  const body = 'Hi ' + quote.customer + ',\\n\\nWe received your request: ' + quote.request + '. Requested date: ' + quote.due_on + '.\\nOur office lead will review it and contact you. No appointment is booked.\\n\\n' + CONFIG.company;
  const mime = [
    'To: ' + quote.contact,
    'Subject: =?UTF-8?B?' + Utilities.base64Encode(subject, Utilities.Charset.UTF_8) + '?=',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '', Utilities.base64Encode(body, Utilities.Charset.UTF_8).match(/.{1,76}/g).join('\\r\\n')
  ].join('\\r\\n');
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
`;
  return {
    "Code.gs": code,
    "appsscript.json":
      JSON.stringify(
        {
          timeZone: "Etc/UTC",
          dependencies: {
            enabledAdvancedServices: [
              { userSymbol: "Gmail", serviceId: "gmail", version: "v1" },
            ],
          },
          exceptionLogging: "STACKDRIVER",
          runtimeVersion: "V8",
          oauthScopes: allowedScopes,
        },
        null,
        2,
      ) + "\n",
    "CLAUDE.md": `# ${config.companyType} — automation brief\n\nExecution stays in the client's Google Workspace. Tracker: ${config.sheetName}. Edition: ${config.edition}. Tools under review: ${config.tools}.\n\nUse a spreadsheet-bound Apps Script, PropertiesService.getScriptProperties(), and ${prefix}_ prefixed keys. No passwords, tokens, private keys, or credential collection. No external services.\n\nUse the Advanced Gmail Service v1 for label-filtered intake and Drafts.create only. Never call send, trash, delete, modify, or GmailApp. Retain exactly the five scopes in appsscript.json; do not add broad mail.google.com, gmail.send, gmail.modify, or Drive scopes. gmail.compose permits sending, so draft-only is a code policy, not an OAuth guarantee. gmail.readonly is mailbox-wide even though the code filters by label.\n\nKeep the eight-column schema and source message IDs immutable. Validate contact and ISO date, preserve bad inputs in Quarantine, and neutralize spreadsheet formulas. Use execution locks and durable DRAFT_PENDING reservations. Never auto-retry uncertain Gmail outcomes. Reconcile REVIEW_REQUIRED or interrupted DRAFT_PENDING rows with the office lead.\n\nRun fixture, failure-injection, repeat-run, and scope checks before handoff. No production deployment claim until tested in the client's authorized bound script. Monday: inspect logs. Wednesday: review drafts with the office lead. Friday: record operational metrics and status.\n`,
    "HANDOFF.md": `# Client handoff — ${config.companyType}\n\n**Owner:** your designated office lead. **Tracker:** ${config.sheetName}. **Edition:** ${config.edition}. Your data and execution stay inside your domain. No new SaaS subscription is required; existing Workspace, setup, and maintenance still have costs.\n\n## Install and configure\n1. The office lead owns the Google Sheet. From that Sheet, open Extensions → Apps Script to create a bound project. Use your own domain account and OAuth consent; never share a password.\n2. To use clasp: run \`clasp login\` on your own machine, then \`clasp clone <bound-script-id>\` in a separate empty directory. Copy Code.gs and appsscript.json from this bundle into that checkout, review the diff, and run \`clasp push\`. Keep CLAUDE.md and HANDOFF.md as local documentation. Never commit .clasprc.json.\n3. In Apps Script Project Settings, set Script Properties: \`${prefix}_SHEET_ID\` = the bound spreadsheet ID; \`${prefix}_INTAKE_LABEL\` = your Gmail intake label (letters, digits, spaces, slash, underscore, hyphen); \`${prefix}_OFFICE_LEAD\` = the responsible person's name. These are configuration, not credentials.\n4. Gmail Advanced Service v1 is enabled by the manifest. For a standard Cloud project also enable the Gmail API in its Cloud console. Review and grant the five manifest scopes under your domain policy. No broad mail scope, send scope, or external HTTP scope is included. Read-only Gmail access is mailbox-wide, not confined by OAuth to one label. gmail.compose also allows sending; the reviewed code calls Drafts.create only.\n5. Create the intake label and a narrowly matching Gmail filter for your website form. Route only trusted form notifications there. The plain-text email body must be a JSON object: \`{"customer":"Alex","contact":"alex@example.com","request":"Quote details","due_on":"2026-11-20"}\`. Human prose, HTML-only mail, and malformed JSON are quarantined.\n6. Set the correct IANA time zone in appsscript.json (default Etc/UTC). Run runMorningTrigger manually against test requests, then repeat it: no extra rows or drafts should appear. Review Quarantine. Run installMorningTrigger as the office lead after acceptance. It creates one daily trigger around 08:00 (Google time triggers are approximate), and protects header/ID ranges. Owner and executing account retain access.\n\n## Weekly ownership\n**Monday:** check Apps Script Executions for errors, quota warnings, and runtime. Paid Workspace reference: 6 minutes/execution, 6 hours trigger runtime/day, 50,000 email read/write operations/day; trials and Google changes can reduce limits. The workbench counters are simulated, not live quota telemetry.\n**Wednesday:** office lead reviews every draft in Gmail, edits it, and chooses whether to send manually. Nothing in this package sends. If a row says REVIEW_REQUIRED or remains DRAFT_PENDING, check Gmail for its quote ID before manually reconciling; do not delete its reservation and blindly rerun. Correct quarantined payloads and create a new intake message after review.\n**Friday:** record observed copy-pastes avoided per job (baseline minus current), failures/quota warnings, drafts created vs. actually sent, and a short status note. Do not treat estimated tool overlap as verified savings. E-signature and dispatch/payment suites need separate suitability review.\n\n## Transfer and remove access\nClient owns the Sheet, script, Cloud project (if used), and intake mailbox. Recreate time triggers as the client's office lead; installable triggers do not transfer with file ownership. Verify the client-run trigger, then have the previous creator delete their triggers and revoke their OAuth grant. Remove vendor editors, deployment access, and temporary admin roles. Stop automation by deleting the trigger; preserve the Sheet, Quarantine, and drafts for review.\n`,
  };
}

export type SecurityCheck = { label: string; pass: boolean; detail: string };
export function lintPackage(files: PackageFiles): SecurityCheck[] {
  let scopes: unknown[] = [];
  let advanced = false;
  try {
    const manifest = JSON.parse(files["appsscript.json"]);
    scopes = manifest.oauthScopes ?? [];
    advanced = manifest.dependencies?.enabledAdvancedServices?.some(
      (service: { userSymbol: string; serviceId: string; version: string }) =>
        service.userSymbol === "Gmail" &&
        service.serviceId === "gmail" &&
        service.version === "v1",
    );
  } catch {
    /* invalid manifest yields failed checks */
  }
  const code = files["Code.gs"]
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  return [
    {
      label: "Exact five-scope allowlist",
      pass:
        scopes.length === allowedScopes.length &&
        new Set(scopes).size === allowedScopes.length &&
        scopes.every((scope) =>
          allowedScopes.includes(scope as (typeof allowedScopes)[number]),
        ),
      detail:
        "Current spreadsheet, Gmail read/compose/labels, trigger management.",
    },
    {
      label: "Gmail Advanced Service (v1)",
      pass: Boolean(advanced) && !/\bGmailApp\s*\./.test(code),
      detail:
        "Broad https://mail.google.com/ & gmail.send scopes excluded by design.",
    },
    {
      label: "Draft creation only",
      pass:
        /Gmail\.Users\.Drafts\.create\(/.test(code) &&
        !/\.(?:send|sendEmail|trash|delete|remove|modify|batchDelete|batchModify)\s*\(/.test(
          code,
        ),
      detail: "Static code check: no send, delete, or mailbox mutation calls.",
    },
    {
      label: "Label-filtered intake",
      pass:
        code.includes("labelIds: [label.id]") && code.includes("q: 'label:"),
      detail:
        "Application boundary. OAuth read permission remains mailbox-wide.",
    },
    {
      label: "Bound-sheet & prefixed properties",
      pass:
        code.includes("getActiveSpreadsheet()") &&
        code.includes("getScriptProperties()") &&
        !code.includes("openById("),
      detail: "Configured Sheet ID must match the bound spreadsheet.",
    },
  ];
}
