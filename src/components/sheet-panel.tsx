"use client";
import { useState } from "react";
import {
  FileSpreadsheet,
  LockKeyhole,
  Mail,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  incomingEmails,
  type BadRow,
  type SheetRow,
  type LogEntry,
} from "@/data/sampleWorkspace";
import { Badge, EmptyState, PanelHeading } from "./ui";

export function SheetPanel({
  loaded,
  rows,
  badRows,
  runCount,
  running,
  sheetName,
  logs,
}: {
  loaded: boolean;
  rows: SheetRow[];
  badRows: BadRow[];
  runCount: number;
  running: boolean;
  sheetName: string;
  logs: LogEntry[];
}) {
  const [tab, setTab] = useState<"valid" | "bad">("valid");
  const [selected, setSelected] = useState<string | null>(null);
  const row = rows.find((row) => row.id === selected);
  return (
    <div className="sheet-layout">
      <section className="panel sheet-panel">
        <PanelHeading
          icon={FileSpreadsheet}
          title={sheetName}
          subtitle="Steps 03–04 / Validated intake → immutable IDs → drafts"
          trailing={<span className="mono small muted">LOCAL SIMULATOR</span>}
        />
        <div className="sheet-tabs" role="tablist" aria-label="Sheet rows">
          <button
            role="tab"
            aria-selected={tab === "valid"}
            onClick={() => setTab("valid")}
            className={tab === "valid" ? "active" : ""}
          >
            Quote requests <span>{rows.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "bad"}
            onClick={() => setTab("bad")}
            className={tab === "bad" ? "active rose-tab" : ""}
          >
            Quarantine / Bad Rows <span>{badRows.length}</span>
          </button>
          <span className="sheet-lock">
            <LockKeyhole size={12} /> Header & ID locked
          </span>
        </div>
        <div
          className="sheet-area"
          role="tabpanel"
          aria-label={tab === "valid" ? "Quote requests" : "Quarantined rows"}
        >
          {tab === "valid" ? (
            <>
              <div className="table-scroll">
                <table className="sheet-table">
                  <thead>
                    <tr>
                      {[
                        "id",
                        "created_at",
                        "customer",
                        "request",
                        "owner",
                        "status",
                        "due_on",
                        "last_action",
                      ].map((field) => (
                        <th key={field}>
                          {field === "id" && <LockKeyhole size={11} />}
                          {field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={row.id === selected ? "selected-row" : ""}
                      >
                        <td>
                          <button
                            className="row-id"
                            onClick={() => setSelected(row.id)}
                            aria-label={`Inspect trace ${row.id}`}
                          >
                            {row.id}
                          </button>
                        </td>
                        <td>{row.created_at.replace("T", " ")}</td>
                        <td>{row.customer}</td>
                        <td>{row.request}</td>
                        <td>{row.owner}</td>
                        <td>
                          <span
                            className={
                              row.status === "Draft ready"
                                ? "text-amber"
                                : "text-green"
                            }
                          >
                            {row.status}
                          </span>
                        </td>
                        <td>{row.due_on}</td>
                        <td>{row.last_action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && (
                <EmptyState
                  icon={FileSpreadsheet}
                  title={
                    loaded ? "Intake loaded. Trigger idle." : "No quote rows"
                  }
                >
                  {loaded
                    ? "Run Trigger to validate five incoming messages. Four will enter the tracker; one will be quarantined."
                    : "Load Sample Data from the command bar to initialize the simulation."}
                </EmptyState>
              )}
            </>
          ) : badRows.length ? (
            <div className="quarantine-list">
              {badRows.map(({ email, errors }) => (
                <article className="quarantine-card" key={email.id}>
                  <div className="flex-between">
                    <strong>
                      <ShieldAlert size={15} /> {email.id}
                    </strong>
                    <Badge tone="rose">VALIDATION_FAILED</Badge>
                  </div>
                  <h3>{email.request}</h3>
                  <ul>
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                  <pre>
                    {JSON.stringify(
                      { contact: email.contact, due_on: email.due_on },
                      null,
                      2,
                    )}
                  </pre>
                  <p>
                    Input preserved. No quote row or Gmail draft created. A
                    repeat run does not duplicate this entry.
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={ShieldAlert} title="No quarantined inputs">
              Validation failures appear here with source IDs and explicit
              reasons.
            </EmptyState>
          )}
        </div>
        <div className="sheet-footer">
          <span>
            {rows.length} rows · {badRows.length} quarantined
          </span>
          <span>Click an ID to inspect its execution trace</span>
        </div>
        {row && (
          <aside className="trace-panel">
            <div className="flex-between">
              <h3>
                Row execution trace <code>{row.id}</code>
              </h3>
              <button
                className="icon-button"
                aria-label="Close execution trace"
                onClick={() => setSelected(null)}
              >
                <X size={14} />
              </button>
            </div>
            <ol>
              <li>
                <code>{row.sourceId}</code> Label-filtered website intake
              </li>
              <li>Contact and due_on validated</li>
              <li>
                <code>{row.id}</code> Stable ID checked against existing rows
              </li>
              <li>Row reserved → reply draft created</li>
              <li
                className={
                  row.status === "Simulated sent" ? "text-green" : "text-amber"
                }
              >
                {row.status === "Simulated sent"
                  ? "Office lead approved simulated send. No delivery."
                  : "Human review gate · no automatic send"}
              </li>
            </ol>
            <div
              className="row-trace-events"
              aria-label={`Recorded events for ${row.id}`}
            >
              {logs
                .filter(
                  (entry) =>
                    entry.message.includes(row.id) ||
                    entry.message.includes(row.sourceId) ||
                    entry.message.includes(row.id.replace("Q-", "DFT-")),
                )
                .map((entry) => (
                  <p key={entry.id}>
                    <time>{entry.time}</time> {entry.message}
                  </p>
                ))}
            </div>
          </aside>
        )}
      </section>
      <section className="panel intake-panel">
        <PanelHeading
          icon={Mail}
          title="Incoming messages"
          subtitle="Synthetic website notifications"
          trailing={
            <span className="mono small muted">{loaded ? "05" : "00"}</span>
          }
        />
        {loaded ? (
          <div className="intake-list">
            {incomingEmails.map((email, index) => (
              <article key={email.id}>
                <div className="flex-between">
                  <code>{email.id}</code>
                  <span
                    className={`small ${index === 4 ? "text-rose" : runCount ? "text-green" : "muted"}`}
                  >
                    {index === 4
                      ? runCount
                        ? "Quarantined"
                        : "Malformed"
                      : runCount
                        ? "Processed"
                        : running
                          ? "Processing"
                          : "Queued"}
                  </span>
                </div>
                <h3>{email.request}</h3>
                <p>{email.customer}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={Mail} title="Inbox not initialized">
            Sample data never connects to a real mailbox.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
