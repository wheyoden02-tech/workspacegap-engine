"use client";
import { useEffect, useRef, useState } from "react";
import { Check, LockKeyhole, Mail, Send, Terminal, X } from "lucide-react";
import type { Draft, LogEntry } from "@/data/sampleWorkspace";
import { type Edition, quotaProfile } from "@/lib/client-config";
import { Badge, EmptyState, PanelHeading } from "./ui";

export function ExecutionConsole({
  logs,
  runtime,
  running,
  edition,
  totalRuntime,
  operations,
}: {
  logs: LogEntry[];
  runtime: string;
  running: boolean;
  edition: Edition;
  totalRuntime: number;
  operations: number;
}) {
  const output = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (output.current) output.current.scrollTop = output.current.scrollHeight;
  }, [logs]);
  const quota = quotaProfile(edition);
  return (
    <section className="panel console-panel">
      <PanelHeading
        icon={Terminal}
        title="Execution console"
        subtitle={`${edition} · simulated usage / published Workspace limits`}
        trailing={
          <span
            className={running ? "text-cyan small mono" : "muted small mono"}
          >
            {running ? "RUNNING" : "IDLE"}
          </span>
        }
      />
      <div className="quota-grid">
        <div>
          <span>LAST EXECUTION</span>
          <strong>
            {runtime}
            <small>s / {quota.executionSeconds}s</small>
          </strong>
        </div>
        <div>
          <span>SESSION / DAILY TRIGGER BUDGET</span>
          <strong>
            {totalRuntime.toFixed(1)}
            <small>
              s / {quota.triggerSecondsDaily.toLocaleString("en-US")}s
            </small>
          </strong>
        </div>
        <div>
          <span>EMAIL READ/WRITE ESTIMATE</span>
          <strong>
            {operations}
            <small>
              {" "}
              / {quota.emailReadWriteDaily.toLocaleString("en-US")}
            </small>
          </strong>
        </div>
      </div>
      <div
        className="console-output"
        ref={output}
        role="log"
        aria-label="Execution log"
      >
        {logs.length ? (
          logs.map((log) => (
            <div key={log.id} className={`log-line log-${log.level}`}>
              <time>{log.time}</time>
              <span>{log.level.toUpperCase()}</span>
              <p>{log.message}</p>
            </div>
          ))
        ) : (
          <div className="console-wait">
            $ waiting for sample data and trigger execution
            <span className="cursor">_</span>
          </div>
        )}
      </div>
      <div className="console-footer">
        <span>
          Paid editions share this quota category. Trial limits may be lower.
        </span>
        <a
          href="https://developers.google.com/apps-script/guides/services/quotas"
          target="_blank"
          rel="noreferrer"
        >
          Google quota reference ↗
        </a>
      </div>
    </section>
  );
}

export function DraftsPanel({
  drafts,
  running,
  onSend,
}: {
  drafts: Draft[];
  running: boolean;
  onSend: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const draft = drafts.find((item) => item.id === selectedId) ?? drafts[0];
  useEffect(() => {
    if (preview) dialog.current?.showModal();
    else dialog.current?.close();
  }, [preview]);
  return (
    <section className="panel draft-panel">
      <PanelHeading
        icon={Mail}
        title="Customer reply drafts"
        subtitle="Gmail Advanced Service v1 / Drafts.create"
        trailing={
          <span className="mono small muted">{drafts.length} DRAFTS</span>
        }
      />
      <div className="draft-lock">
        <LockKeyhole size={13} /> GMAIL DRAFT — Awaiting Office Lead Approval
      </div>
      {draft ? (
        <div className="draft-workspace">
          <nav className="draft-list" aria-label="Customer drafts">
            {drafts.map((item) => (
              <button
                key={item.id}
                className={item.id === draft.id ? "active" : ""}
                onClick={() => setSelectedId(item.id)}
              >
                <span>{item.customer}</span>
                <code>{item.id}</code>
                <small className={item.sent ? "text-green" : "text-amber"}>
                  {item.sent ? "Simulated sent" : "Awaiting approval"}
                </small>
              </button>
            ))}
          </nav>
          <article className="draft-preview">
            <div className="draft-meta">
              <span>To</span>
              <strong>{draft.to}</strong>
              <span>Subject</span>
              <strong>{draft.subject}</strong>
            </div>
            <div className="draft-body">{draft.body}</div>
            <button
              className="secondary-button"
              disabled={draft.sent || running}
              onClick={() => setPreview(true)}
            >
              {draft.sent ? <Check size={14} /> : <Send size={14} />}
              {draft.sent
                ? "Send simulated · no email delivered"
                : "Approve & Simulate Send"}
            </button>
            <p className="draft-footnote">
              This workbench never sends. Production drafts are reviewed and
              sent manually in Gmail.
            </p>
          </article>
        </div>
      ) : (
        <EmptyState icon={Mail} title="No drafts created">
          Run the sample trigger to create four replies. Malformed submissions
          never produce a draft.
        </EmptyState>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="review-title"
        onCancel={() => setPreview(false)}
        onClose={() => setPreview(false)}
        className="review-dialog"
      >
        <button
          className="dialog-close icon-button"
          aria-label="Close preview"
          onClick={() => setPreview(false)}
        >
          <X size={16} />
        </button>
        <Badge tone="amber">OFFICE LEAD CHECKPOINT</Badge>
        <h2 id="review-title">Review simulated send</h2>
        <p className="muted">
          Updates local state only. No Gmail connection or email delivery.
        </p>
        {draft && (
          <>
            <div className="review-address">
              To: {draft.to}
              <br />
              Subject: {draft.subject}
            </div>
            <div className="draft-body">{draft.body}</div>
            <button
              className="primary-button"
              onClick={() => {
                onSend(draft.id);
                setPreview(false);
              }}
            >
              <Check size={14} /> Confirm simulated send
            </button>
          </>
        )}
      </dialog>
    </section>
  );
}
