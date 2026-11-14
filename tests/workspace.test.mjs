import { test } from "node:test";
import assert from "node:assert/strict";
import {
  incomingEmails,
  validateEmail,
  createArtifacts,
  paidTools,
} from "../src/data/sampleWorkspace.ts";

test("sample intake preserves one malformed submission with both error reasons", () => {
  assert.equal(incomingEmails.length, 5);
  const valid = incomingEmails.filter(
    (email) => validateEmail(email).length === 0,
  );
  assert.equal(valid.length, 4);
  assert.deepEqual(validateEmail(incomingEmails[4]), [
    "Missing or invalid customer contact",
    "Invalid due_on: expected YYYY-MM-DD",
  ]);
});

test("date validation rejects calendar rollover and accepts a real leap day", () => {
  const base = incomingEmails[0];
  for (const date of [
    "2026-02-30",
    "2026-13-01",
    "2026-11-00",
    "11/20/2026",
    "",
  ]) {
    assert.ok(validateEmail({ ...base, due_on: date }).length > 0, date);
  }
  assert.deepEqual(validateEmail({ ...base, due_on: "2028-02-29" }), []);
});

test("quote and reply link stable source IDs without sending or booking", () => {
  const { row, draft } = createArtifacts(incomingEmails[0], 0);
  assert.equal(row.sourceId, "MSG-1041");
  assert.equal(draft.rowId, row.id);
  assert.equal(draft.to, incomingEmails[0].contact);
  assert.equal(draft.sent, false);
  assert.match(draft.body, /no appointment is booked yet/);
  assert.equal(row.status, "Draft ready");
});

test("savings exclude the retained e-signature subscription", () => {
  assert.equal(
    paidTools
      .filter((tool) => tool.covered)
      .reduce((sum, tool) => sum + tool.cost, 0),
    78,
  );
  assert.equal(paidTools.find((tool) => !tool.covered).cost, 35);
});
