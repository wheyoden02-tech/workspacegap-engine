"use client";
import { Check, ClipboardCheck, RotateCcw } from "lucide-react";
import { PanelHeading } from "./ui";
export type RunbookState = {
  checks: boolean[];
  baseline: string;
  current: string;
  note: string;
  fridaySaved: boolean;
};
export const initialRunbook: RunbookState = {
  checks: [false, false, false],
  baseline: "0",
  current: "0",
  note: "",
  fridaySaved: false,
};
export function OpsPanel({
  state,
  onChange,
  failures,
  drafts,
  sent,
  quotaWarnings,
}: {
  state: RunbookState;
  onChange: (value: RunbookState) => void;
  failures: number;
  drafts: number;
  sent: number;
  quotaWarnings: number;
}) {
  const saved = Math.max(0, Number(state.baseline) - Number(state.current));
  return (
    <section className="panel ops-panel">
      <PanelHeading
        icon={ClipboardCheck}
        title="Weekly runbook & metrics"
        subtitle="Client office lead / local session tracker"
        trailing={
          <button
            className="icon-button"
            aria-label="Reset weekly runbook"
            onClick={() => onChange(initialRunbook)}
          >
            <RotateCcw size={14} />
          </button>
        }
      />
      <div className="runbook-tasks">
        {[
          {
            day: "MON",
            title: "Check execution logs",
            description:
              "Review failures, quotas, and incomplete row reservations.",
          },
          {
            day: "WED",
            title: "Review drafts with office lead",
            description:
              "Verify customer, request, and dates before any manual send.",
          },
          {
            day: "FRI",
            title: "Record the weekly status",
            description:
              "Review measured effort, failure counts, and actual sends.",
          },
        ].map((task, i) => (
          <label key={task.day} className="runbook-task">
            <input
              type="checkbox"
              checked={state.checks[i]}
              onChange={(e) =>
                onChange({
                  ...state,
                  checks: state.checks.map((checked, index) =>
                    index === i ? e.target.checked : checked,
                  ),
                })
              }
            />
            <span className="day mono">{task.day}</span>
            <span>
              <strong>{task.title}</strong>
              <small>{task.description}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="ops-metrics">
        <div>
          <span>Copy-pastes eliminated / job</span>
          <strong>
            {saved}
            <small> measured from inputs below</small>
          </strong>
        </div>
        <div>
          <span>Script failures / quota warnings</span>
          <strong>
            {failures}
            <small> / {quotaWarnings}</small>
          </strong>
        </div>
        <div>
          <span>Drafts created / simulated sent</span>
          <strong>
            {drafts}
            <small> / {sent}</small>
          </strong>
        </div>
      </div>
      <div className="copy-inputs">
        <label>
          Baseline copy-pastes / job
          <input
            type="number"
            min="0"
            max="999"
            value={state.baseline}
            onChange={(e) => onChange({ ...state, baseline: e.target.value })}
          />
        </label>
        <label>
          Current copy-pastes / job
          <input
            type="number"
            min="0"
            max="999"
            value={state.current}
            onChange={(e) => onChange({ ...state, current: e.target.value })}
          />
        </label>
      </div>
      <form
        className="status-form"
        onSubmit={(e) => {
          e.preventDefault();
          onChange({ ...state, fridaySaved: true });
        }}
      >
        <label htmlFor="weekly-note">Friday status note</label>
        <textarea
          id="weekly-note"
          rows={3}
          required
          maxLength={1000}
          placeholder="What changed, what failed, and what needs the client’s decision?"
          value={state.note}
          onChange={(e) =>
            onChange({ ...state, note: e.target.value, fridaySaved: false })
          }
        />
        <div className="flex-between">
          <span className="small muted">
            Local session only · resets on reload
          </span>
          <button type="submit" className="secondary-button">
            {state.fridaySaved && <Check size={13} />}
            {state.fridaySaved ? "Status recorded" : "Record status"}
          </button>
        </div>
      </form>
    </section>
  );
}
