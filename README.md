# WorkspaceGap // Workbench

A browser-local engineering workbench for assessing tool overlap and packaging domain-owned Google Workspace quote intake. Built with Next.js App Router, TypeScript, Tailwind CSS, Lucide, and JSZip.

## Development

Use Node.js 24 (pinned in `.nvmrc` and `package.json` for local, CI, and Vercel builds).

```sh
npm install
npm run dev
```

Open http://localhost:3000. Production: `npm run build` then `npm start`.

```sh
npm test
npx tsc --noEmit
npm run build
```

The tracked [`sample-clasp-delivery/`](sample-clasp-delivery/) folder contains real GreenScape `Code.gs`, `appsscript.json`, `CLAUDE.md`, `HANDOFF.md`, and `.claspignore` files. They are generated from the same source as the workbench ZIP. There is no fake script ID or OAuth credential in this folder. Bind it to a client-owned Apps Script project using its handoff instructions before pushing to Google.

```sh
npm run generate:sample
npm run check:sample
```

Run the complete production-readiness check (installs the test browsers once first):

```sh
npx playwright install chromium firefox webkit
npm run verify
```

`verify` checks sample-file synchronization, TypeScript, unit tests, a production build, and browser tests against a production server on `127.0.0.1:3100`. Port 3100 must be free. The suite closes its server on completion. Browser tests cover Chromium, Firefox, and WebKit at 375px; real Chromium clipboard writes; denied/stalled clipboard APIs and textarea fallbacks; sample idempotency, quarantine, approval metrics; and custom-client ZIP downloads. Native clipboard permission automation is Chromium-specific; those cases are not claimed as native clipboard API verification in Firefox/WebKit. Both fallback paths run in all engines. If both clipboard APIs are denied, the UI exposes selected text instead of falsely claiming success.

GitHub Actions runs the same checks for pushes and pull requests. Browser screenshots, traces, and reports are written to ignored `test-results/` and `playwright-report/` directories; failure artifacts are uploaded by CI. Environment-specific `.clasp.json`, `.clasprc.json`, `.vercel/`, and `.env` files are ignored.

## Workbench views

1. **Discovery & tool overlap**: explicitly labeled sample DNS, careers, and widget signals; honest tool coverage decisions. Unknown custom tools require review. Sample prices are not verified savings.
2. **Live sheet & quarantine**: load five synthetic requests, run the trigger, inspect four valid rows and one quarantine entry. Headers and the ID column stay pinned. Click any row ID for its trace. Repeat runs skip all five source IDs.
3. **Gmail drafts & weekly ops**: inspect four drafts, use the office-lead review checkpoint to simulate a send, track Monday/Wednesday/Friday checks, enter measured copy-pastes, and record a weekly status note.
4. **Clasp package & handoff**: inspect/copy `Code.gs`, `appsscript.json`, `CLAUDE.md`, and `HANDOFF.md`; download those exact files plus `.claspignore` as a ZIP. Use the Custom Client Builder environment to regenerate them from the four required inputs.

All workbench state is session-only and resets on reload. Changing client configurations resets the sample simulation; Load Sample Data returns to GreenScape. No credentials, tokens, live mailbox connections, or Google deployment operations are requested or performed. The custom form contains only company type, tool names, tracker name, and Workspace edition. Do not paste secrets into descriptive fields.

## Generated Apps Script boundary

The exported script uses **Advanced Gmail Service v1**, not GmailApp. Its manifest contains exactly:

- `spreadsheets.currentonly`
- `gmail.readonly`
- `gmail.compose`
- `gmail.labels`
- `script.scriptapp`

The client must install it in a **spreadsheet-bound** project under their own domain, configure the prefixed Script Properties and intake label/filter, enable the Gmail API when using a standard Cloud project, and set their IANA timezone. `HANDOFF.md` contains the setup and access-removal sequence. The intake contract is a plain-text JSON form notification with `customer`, `contact`, `request`, and ISO `due_on`; HTML-only/prose/invalid messages go to Quarantine.

The script checks existing source-message IDs in both sheets, holds an execution lock, neutralizes spreadsheet formulas, and writes a durable reservation before the draft API call. Ambiguous API failures become `REVIEW_REQUIRED`; interrupted `DRAFT_PENDING` rows require human reconciliation. They are never blindly retried. Draft-only behavior is checked in generated source, including exclusion of send/delete/modify calls.

**OAuth limitation:** Google's `gmail.compose` scope also permits sending. Excluding `gmail.send` does not create a protocol-level no-send guarantee. Draft-only is a code-review policy. `gmail.readonly` is mailbox-wide; the intake label is an application filter, not an OAuth boundary. The UI, code comments, and handoff state these limits explicitly. No broad `mail.google.com`, mailbox modification, external HTTP, or Drive scopes are included.

Published paid Workspace reference limits are 360 seconds/execution, 21,600 seconds/day of trigger runtime, and 50,000 daily email read/write operations. Google does not publish different values for the four paid editions here; trials may have lower limits. The workbench displays simulated session usage and read/write estimates, not live quota telemetry or a draft-specific sending quota.

## Validation

The test suite executes the actual generated `Code.gs` in a mocked Apps Script environment, covering valid intake, quarantine, MIME decoding, stable-ID repeat runs, formula neutralization, bound-sheet mismatch, and ambiguous draft failures. It also verifies exact manifest scopes, linter rejection of send calls or scope expansion, custom-client substitution, and ZIP contents.

Live OAuth consent, Google service behavior, client access policy, and deployment must still be accepted in an authorized client test project. Installable triggers execute approximately around 08:00 in the configured timezone; they are not exact schedulers and must be recreated by the client office lead during transfer.

## Source layout

- `src/lib/client-config.ts`: four input types, validation, tool mapping, quotas
- `src/lib/package-generator.ts`: generated source/documents and security checks
- `src/lib/bundle.ts`: JSZip packaging
- `src/hooks/use-workspace.ts`: sample pipeline, locks, deduplication, logs
- `src/data/sampleWorkspace.ts`: five-message fixture and simulation schema
- `src/components/`: four workbench views, builder, execution console, review gate
- `tests/`: fixture and generated-package behavioral checks

References: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas).
