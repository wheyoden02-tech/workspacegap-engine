# GreenScape Landscaping LLC — automation brief

Execution stays in the client's Google Workspace. Tracker: GreenScape Quote Pipeline. Edition: Business Standard. Tools under review: Form Builder, Scheduling Tool, E-Signature Tool.

Use a spreadsheet-bound Apps Script, PropertiesService.getScriptProperties(), and GREENSCAPE_ prefixed keys. No passwords, tokens, private keys, or credential collection. No external services.

Use the Advanced Gmail Service v1 for label-filtered intake and Drafts.create only. Never call send, trash, delete, modify, or GmailApp. Retain exactly the five scopes in appsscript.json; do not add broad mail.google.com, gmail.send, gmail.modify, or Drive scopes. gmail.compose permits sending, so draft-only is a code policy, not an OAuth guarantee. gmail.readonly is mailbox-wide even though the code filters by label.

Keep the eight-column schema and source message IDs immutable. Validate contact and ISO date, preserve bad inputs in Quarantine, and neutralize spreadsheet formulas. Use execution locks and durable DRAFT_PENDING reservations. Never auto-retry uncertain Gmail outcomes. Reconcile REVIEW_REQUIRED or interrupted DRAFT_PENDING rows with the office lead.

Run fixture, failure-injection, repeat-run, and scope checks before handoff. No production deployment claim until tested in the client's authorized bound script. Monday: inspect logs. Wednesday: review drafts with the office lead. Friday: record operational metrics and status.
