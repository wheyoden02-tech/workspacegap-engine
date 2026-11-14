import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import JSZip from "jszip";
import {
  sampleConfig,
  clientPrefix,
  validateConfig,
  toolOverlap,
  quotaProfile,
} from "../src/lib/client-config.ts";
import {
  generatePackage,
  allowedScopes,
  lintPackage,
} from "../src/lib/package-generator.ts";
import { buildBundle } from "../src/lib/bundle.ts";

const files = generatePackage(sampleConfig);
test("manifest enables Advanced Gmail v1 and includes exactly the five approved scopes", () => {
  const manifest = JSON.parse(files["appsscript.json"]);
  assert.deepEqual(manifest.oauthScopes, allowedScopes);
  assert.deepEqual(manifest.dependencies.enabledAdvancedServices, [
    { userSymbol: "Gmail", serviceId: "gmail", version: "v1" },
  ]);
  assert.ok(lintPackage(files).every((check) => check.pass));
  new vm.Script(files["Code.gs"]);
});

test("security linter fails scope expansion and send-call injection", () => {
  const expanded = JSON.parse(files["appsscript.json"]);
  expanded.oauthScopes.push("https://mail.google.com/");
  assert.equal(
    lintPackage({ ...files, "appsscript.json": JSON.stringify(expanded) })[0]
      .pass,
    false,
  );
  assert.equal(
    lintPackage({
      ...files,
      "Code.gs": files["Code.gs"] + '\nGmail.Users.Drafts.send({}, "me");',
    })[2].pass,
    false,
  );
});

test("custom client changes identity, properties, documentation, and honest coverage", () => {
  const config = {
    companyType: "HVAC & Plumbing Contractor",
    tools: "Jobber, Typeform, DocuSign",
    sheetName: "Weekly Open Quotes & Dispatch Tracker",
    edition: "Business Plus",
  };
  assert.deepEqual(validateConfig(config), []);
  assert.equal(clientPrefix(config), "HVAC_PLUMBING_CONTRACTOR");
  const custom = generatePackage(config);
  for (const name of ["Code.gs", "CLAUDE.md", "HANDOFF.md"])
    assert.ok(custom[name].includes(config.companyType));
  assert.match(custom["HANDOFF.md"], /HVAC_PLUMBING_CONTRACTOR_SHEET_ID/);
  assert.deepEqual(
    toolOverlap(config).map((tool) => tool.decision),
    ["Review", "Candidate", "Retain"],
  );
  assert.ok(toolOverlap(config).every((tool) => tool.cost === undefined));
  assert.equal(quotaProfile("Business Starter").executionSeconds, 360);
  assert.equal(quotaProfile("Enterprise").triggerSecondsDaily, 21600);
  assert.ok(validateConfig({ ...config, sheetName: "Quarantine" }).length);
  assert.ok(validateConfig({ ...config, companyType: "" }).length);
  new vm.Script(
    generatePackage({ ...config, companyType: 'Client "Quoted" <script>' })[
      "Code.gs"
    ],
  );
});

test("ZIP contains all four exact generated files plus safe clasp exclusions", async () => {
  const bytes = await buildBundle(files);
  const zip = await JSZip.loadAsync(bytes);
  assert.deepEqual(
    Object.keys(zip.files).sort(),
    [...Object.keys(files), ".claspignore"].sort(),
  );
  for (const [name, text] of Object.entries(files))
    assert.equal(await zip.file(name).async("string"), text);
  assert.equal(zip.file(".clasprc.json"), null);
});

function harness({ failDraft = false, sheetMismatch = false } = {}) {
  const drafts = [];
  const sheets = new Map();
  const requests = [];
  const messages = [
    ...[1, 2, 3, 4].map((i) => ({
      id: `m${i}`,
      quote: {
        customer: i === 1 ? '=IMPORTXML("x")' : `Customer ${i}`,
        contact: `customer${i}@example.com`,
        request: "Site visit",
        due_on: "2026-11-20",
      },
    })),
    {
      id: "bad",
      quote: {
        customer: "Unknown",
        request: "Corrupt",
        due_on: "next-friday-ish",
      },
    },
  ];
  const range = (sheet, row, column, count = 1, columns = 1) => ({
    getValues: () =>
      Array.from({ length: count }, (_, i) =>
        Array.from(
          { length: columns },
          (_, j) => sheet.rows[row + i - 1]?.[column + j - 1] ?? "",
        ),
      ),
    getDisplayValues() {
      return this.getValues().map((row) => row.map(String));
    },
    setValue(value) {
      sheet.rows[row - 1][column - 1] = value;
    },
  });
  const ss = {
    getId: () => (sheetMismatch ? "wrong" : "sheet-123"),
    getSheetByName: (name) => sheets.get(name),
    insertSheet(name) {
      const sheet = {
        rows: [],
        getLastRow() {
          return this.rows.length;
        },
        getLastColumn() {
          return this.rows[0]?.length || 0;
        },
        appendRow(row) {
          this.rows.push([...row]);
        },
        getRange(row, col, count, columns) {
          return range(this, row, col, count, columns);
        },
        setFrozenRows() {},
        setFrozenColumns() {},
      };
      sheets.set(name, sheet);
      return sheet;
    },
  };
  let locks = 0;
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) =>
          ({
            GREENSCAPE_SHEET_ID: "sheet-123",
            GREENSCAPE_INTAKE_LABEL: "Website/Quotes",
            GREENSCAPE_OFFICE_LEAD: "Janet",
          })[key],
      }),
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          locks++;
          return true;
        },
        releaseLock: () => {
          locks--;
        },
      }),
    },
    Utilities: {
      Charset: { UTF_8: "utf8" },
      base64DecodeWebSafe: (value) => Buffer.from(value, "base64url"),
      newBlob: (buffer) => ({ getDataAsString: () => buffer.toString("utf8") }),
      base64Encode: (value) => Buffer.from(value).toString("base64"),
      base64EncodeWebSafe: (value) => Buffer.from(value).toString("base64url"),
    },
    Gmail: {
      Users: {
        Labels: {
          list: () => ({ labels: [{ id: "label-1", name: "Website/Quotes" }] }),
        },
        Messages: {
          list: (_user, query) => {
            requests.push(query);
            return { messages: messages.map(({ id }) => ({ id })) };
          },
          get: (_user, id) => ({
            payload: {
              mimeType: "text/plain",
              body: {
                data: Buffer.from(
                  JSON.stringify(messages.find((m) => m.id === id).quote),
                ).toString("base64url"),
              },
            },
          }),
        },
        Drafts: {
          create: (payload) => {
            drafts.push(payload);
            if (failDraft) throw new Error("Simulated ambiguous API failure");
            return { id: `draft-${drafts.length}` };
          },
        },
      },
    },
  });
  vm.runInContext(files["Code.gs"], context);
  return { context, drafts, sheets, requests, locks: () => locks };
}

test("generated script processes four quotes, quarantines one, and blocks all duplicate writes", () => {
  const h = harness();
  vm.runInContext("runMorningTrigger()", h.context);
  assert.equal(h.drafts.length, 4);
  assert.equal(h.sheets.get(sampleConfig.sheetName).rows.length, 5);
  assert.equal(h.sheets.get("Quarantine").rows.length, 2);
  assert.match(h.sheets.get(sampleConfig.sheetName).rows[1][2], /^'/);
  assert.deepEqual(Array.from(h.requests[0].labelIds), ["label-1"]);
  assert.match(h.requests[0].q, /label:"Website\/Quotes"/);
  const mime = Buffer.from(h.drafts[0].message.raw, "base64url").toString(
    "utf8",
  );
  assert.match(mime, /To: customer1@example.com\r\n/);
  assert.match(mime, /Content-Transfer-Encoding: base64/);
  const body = Buffer.from(
    mime.split("\r\n\r\n")[1].replace(/\r\n/g, ""),
    "base64",
  ).toString("utf8");
  assert.match(body, /No appointment is booked/);
  vm.runInContext("runMorningTrigger()", h.context);
  assert.equal(h.drafts.length, 4);
  assert.equal(h.sheets.get(sampleConfig.sheetName).rows.length, 5);
  assert.equal(h.sheets.get("Quarantine").rows.length, 2);
  assert.equal(h.locks(), 0);
});

test("ambiguous draft failure leaves a durable review reservation instead of auto-retrying", () => {
  const h = harness({ failDraft: true });
  assert.throws(
    () => vm.runInContext("runMorningTrigger()", h.context),
    /Office lead reconciliation/,
  );
  assert.equal(
    h.sheets.get(sampleConfig.sheetName).rows[1][5],
    "REVIEW_REQUIRED",
  );
  assert.equal(h.locks(), 0);
  assert.throws(() => vm.runInContext("runMorningTrigger()", h.context));
  assert.equal(
    h.sheets.get(sampleConfig.sheetName).rows.filter((row) => row[0] === "m1")
      .length,
    1,
  );
  assert.equal(h.drafts.length, 2); // second run attempted m2, never retried m1
});

test("bound-sheet mismatch fails before any Gmail or sheet writes", () => {
  const h = harness({ sheetMismatch: true });
  assert.throws(
    () => vm.runInContext("runMorningTrigger()", h.context),
    /does not match/,
  );
  assert.equal(h.drafts.length, 0);
  assert.equal(h.sheets.size, 0);
  assert.equal(h.requests.length, 0);
  assert.equal(h.locks(), 0);
});
