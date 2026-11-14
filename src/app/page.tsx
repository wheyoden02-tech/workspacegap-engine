"use client";
import { useState } from "react";
import {
  ArrowDownToLine,
  Braces,
  ChevronRight,
  ClipboardList,
  Code2,
  FileSpreadsheet,
  LockKeyhole,
  Play,
  RotateCcw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { AuditPanel } from "@/components/audit-panel";
import { SheetPanel } from "@/components/sheet-panel";
import { DraftsPanel, ExecutionConsole } from "@/components/drafts-panel";
import {
  OpsPanel,
  initialRunbook,
  type RunbookState,
} from "@/components/ops-panel";
import { PackagePanel } from "@/components/package-panel";
import { ClientBuilder } from "@/components/client-builder";
import { sampleConfig, type ClientConfig } from "@/lib/client-config";
import { useWorkspace } from "@/hooks/use-workspace";

const tabs = [
  {
    id: "discovery",
    number: "01",
    label: "Discovery & tool overlap",
    icon: ScanLine,
  },
  {
    id: "sheet",
    number: "02",
    label: "Live sheet & quarantine",
    icon: FileSpreadsheet,
  },
  {
    id: "drafts",
    number: "03",
    label: "Gmail drafts & weekly ops",
    icon: ClipboardList,
  },
  {
    id: "package",
    number: "04",
    label: "Clasp package & handoff",
    icon: Code2,
  },
] as const;
type TabId = (typeof tabs)[number]["id"];
export default function Home() {
  const workspace = useWorkspace();
  const [tab, setTab] = useState<TabId>("discovery");
  const [mode, setMode] = useState<"sample" | "custom">("sample");
  const [config, setConfig] = useState<ClientConfig>(sampleConfig);
  const [custom, setCustom] = useState<ClientConfig>({
    companyType: "",
    tools: "",
    sheetName: "",
    edition: "Business Standard",
  });
  const [builder, setBuilder] = useState(false);
  const [runbook, setRunbook] = useState<RunbookState>(initialRunbook);
  const [message, setMessage] = useState(
    "Local simulation. No Google account connected.",
  );
  function loadSample() {
    if (workspace.running) return;
    setMode("sample");
    setConfig(sampleConfig);
    workspace.load();
    setRunbook(initialRunbook);
    setTab("sheet");
    setMessage(
      "Sample loaded: 5 intake messages. Run the trigger to inspect validation and draft creation.",
    );
  }
  function generate(value: ClientConfig) {
    if (workspace.running) return;
    setCustom(value);
    setConfig(value);
    setMode("custom");
    setBuilder(false);
    workspace.reset();
    setRunbook(initialRunbook);
    setTab("package");
    setMessage(
      "Custom package generated locally. Public signals remain unverified; review the handoff before deployment.",
    );
  }
  async function run(again = false) {
    if (!again) setTab("sheet");
    setMessage(
      again
        ? "Idempotency test running. Existing source IDs are checked before every write."
        : "Trigger running: intake → validation → sheet rows → Gmail drafts.",
    );
    const completed = await workspace.run();
    if (!completed) {
      setMessage(
        "Execution failed. Inspect the execution log before retrying.",
      );
      return;
    }
    setMessage(
      again
        ? "Repeat run complete. Previously processed and quarantined source IDs were skipped."
        : "Trigger complete. Review the sheet, quarantine, and office-lead draft gate.",
    );
  }
  return (
    <div className="workbench">
      <header className="command-bar">
        <a className="brand" href="#workbench">
          <Workflow size={18} />
          <strong>
            WorkspaceGap <span>//</span> Workbench
          </strong>
        </a>
        <div className="environment-switch">
          <select
            aria-label="Environment switcher"
            value={mode}
            disabled={workspace.running}
            onChange={(event) => {
              if (event.target.value === "custom") setBuilder(true);
              else {
                setMode("sample");
                setConfig(sampleConfig);
                workspace.reset();
                setMessage(
                  "Sample environment selected. Load Sample Data to initialize intake.",
                );
              }
            }}
          >
            <option value="sample">Sample: GreenScape Landscaping</option>
            <option value="custom">Custom Client Builder</option>
          </select>
        </div>
        {mode === "custom" && (
          <button
            className="icon-button"
            disabled={workspace.running}
            aria-label="Edit custom client inputs"
            onClick={() => setBuilder(true)}
          >
            <Settings2 size={14} />
          </button>
        )}
        <div className="command-actions">
          <button
            className="secondary-button"
            onClick={loadSample}
            disabled={workspace.running}
          >
            <ArrowDownToLine size={13} />
            Load Sample Data
          </button>
          <button
            className="primary-button"
            onClick={() => run()}
            disabled={!workspace.loaded || workspace.running}
          >
            <Play size={12} />
            {workspace.running ? "Running…" : "Run Trigger"}
          </button>
          <button
            className="text-button"
            onClick={() => run(true)}
            disabled={!workspace.runCount || workspace.running}
          >
            <RotateCcw size={12} />
            Run Again (Idempotency)
          </button>
        </div>
      </header>
      <div className="workspace-heading" id="workbench">
        <div>
          <span className="workspace-label">
            <Braces size={15} /> WORKSPACE / {mode.toUpperCase()}
          </span>
          <ChevronRight size={13} />
          <h1>{config.companyType}</h1>
        </div>
        <span className="workspace-edition">
          {config.edition} <span className="mono">/ LOCAL</span>
        </span>
      </div>
      <nav
        className="workbench-tabs"
        role="tablist"
        aria-label="Workbench views"
      >
        {tabs.map(({ id, number, label, icon: Icon }) => (
          <button
            id={`tab-${id}`}
            aria-controls={`panel-${id}`}
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <span className="tab-number">{number}</span>
            <Icon size={14} />
            {label}
            {id === "sheet" && workspace.badRows.length > 0 && (
              <span className="tab-alert">{workspace.badRows.length}</span>
            )}
            {id === "drafts" && workspace.drafts.length > 0 && (
              <span className="tab-count">{workspace.drafts.length}</span>
            )}
          </button>
        ))}
      </nav>
      <main>
        <div className="view-toolbar">
          <div>
            <span
              className={`state-dot ${workspace.running ? "running" : workspace.loaded ? "ready" : ""}`}
            />
            <span>
              {workspace.running
                ? "EXECUTION ACTIVE"
                : workspace.loaded
                  ? "SANDBOX INITIALIZED"
                  : mode === "custom"
                    ? "CUSTOM PACKAGE"
                    : "SANDBOX IDLE"}
            </span>
            <span className="toolbar-divider" />
            {workspace.loaded
              ? `${workspace.rows.length} rows · ${workspace.drafts.length} drafts · ${workspace.badRows.length} quarantined · ${workspace.duplicates} duplicates blocked`
              : "No live data access"}
          </div>
          <span className="mono">
            run / {String(workspace.runCount).padStart(3, "0")}
          </span>
        </div>
        <div className="notice" role="status">
          {message}
        </div>
        <section
          className="view-content"
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
        >
          {tab === "discovery" && (
            <AuditPanel config={config} sample={mode === "sample"} />
          )}
          {tab === "sheet" && (
            <SheetPanel
              loaded={workspace.loaded}
              rows={workspace.rows}
              badRows={workspace.badRows}
              runCount={workspace.runCount}
              running={workspace.running}
              sheetName={config.sheetName}
              logs={workspace.logs}
            />
          )}
          {tab === "drafts" && (
            <div className="ops-layout">
              <DraftsPanel
                drafts={workspace.drafts}
                running={workspace.running}
                onSend={workspace.simulateSend}
              />
              <OpsPanel
                state={runbook}
                onChange={setRunbook}
                failures={
                  workspace.logs.filter((log) => log.level === "error").length
                }
                quotaWarnings={
                  workspace.logs.filter(
                    (log) =>
                      log.level === "warn" && /quota|budget/i.test(log.message),
                  ).length
                }
                drafts={workspace.drafts.length}
                sent={workspace.drafts.filter((draft) => draft.sent).length}
              />
            </div>
          )}
          {tab === "package" && <PackagePanel config={config} />}
        </section>
        {tab !== "package" && (
          <ExecutionConsole
            logs={workspace.logs}
            runtime={workspace.runtime}
            running={workspace.running}
            edition={config.edition}
            totalRuntime={workspace.totalRuntime}
            operations={workspace.emailOperations}
          />
        )}
      </main>
      <footer className="security-bar">
        <span>
          <ShieldCheck size={13} />
          Zero-Credential Architecture: Admin-granted scopes & Script Properties
          only
        </span>
        <span>
          <LockKeyhole size={11} /> DRAFT-ONLY CODE POLICY{" "}
          <span className="footer-separator">/</span>
          <code>v0.2.0</code>
        </span>
      </footer>
      {builder && (
        <ClientBuilder
          config={custom}
          onGenerate={generate}
          onClose={() => setBuilder(false)}
        />
      )}
    </div>
  );
}
