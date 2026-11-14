"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Code2,
  Copy,
  Download,
  FileCode2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  generatePackage,
  fileNames,
  lintPackage,
  type PackageFiles,
} from "@/lib/package-generator";
import { clientPrefix, type ClientConfig } from "@/lib/client-config";
import { Badge, PanelHeading } from "./ui";
import { copyText } from "@/lib/clipboard";
export function PackagePanel({ config }: { config: ClientConfig }) {
  const files = useMemo(() => generatePackage(config), [config]);
  const checks = useMemo(() => lintPackage(files), [files]);
  const [selected, setSelected] = useState<keyof PackageFiles>("Code.gs");
  const [feedback, setFeedback] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">(
    "idle",
  );
  const copyRequest = useRef(0);
  useEffect(() => {
    copyRequest.current++;
    setCopyState("idle");
    setManualCopy(false);
    setFeedback("");
    return () => {
      copyRequest.current++;
    };
  }, [config]);
  async function copy() {
    const name = selected;
    const text = files[name];
    const request = ++copyRequest.current;
    setManualCopy(false);
    setCopyState("copying");
    setFeedback(`Copying ${name}…`);
    const copied = await copyText(text);
    if (request !== copyRequest.current) return;
    if (copied) {
      setCopyState("copied");
      setFeedback(`${name} copied.`);
    } else {
      setCopyState("idle");
      setManualCopy(true);
      setFeedback(
        "Clipboard access unavailable. The file text below is selected; press Ctrl+C or Command+C.",
      );
    }
  }
  async function download() {
    setDownloading(true);
    try {
      const { buildBundle } = await import("@/lib/bundle");
      const bytes = await buildBundle(files);
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/zip" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${clientPrefix(config).toLowerCase()}-workspace-clasp.zip`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setFeedback(
        "Clasp bundle downloaded. Review HANDOFF.md before installation.",
      );
    } catch {
      setFeedback("Bundle generation failed. Retry or copy each file.");
    } finally {
      setDownloading(false);
    }
  }
  return (
    <div className="package-layout">
      <section className="panel code-panel">
        <PanelHeading
          icon={Code2}
          title="Clasp package & handoff"
          subtitle="Step 05 / Generated from the active client configuration"
          trailing={<Badge>{clientPrefix(config)}</Badge>}
        />
        <div className="file-toolbar">
          <div className="file-tabs" role="tablist" aria-label="Package files">
            {fileNames.map((name) => (
              <button
                key={name}
                role="tab"
                aria-selected={selected === name}
                className={selected === name ? "active" : ""}
                onClick={() => {
                  setSelected(name);
                  setFeedback("");
                  setManualCopy(false);
                  copyRequest.current++;
                  setCopyState("idle");
                }}
              >
                <FileCode2 size={12} />
                {name}
              </button>
            ))}
          </div>
          <button
            className="text-button"
            onClick={copy}
            disabled={copyState === "copying"}
            aria-label={
              copyState === "copied"
                ? "Copied"
                : copyState === "copying"
                  ? "Copying file"
                  : "Copy File"
            }
          >
            {copyState === "copied" ? <Check size={13} /> : <Copy size={13} />}
            {copyState === "copied"
              ? "Copied"
              : copyState === "copying"
                ? "Copying…"
                : "Copy File"}
          </button>
        </div>
        {manualCopy && (
          <textarea
            className="manual-copy"
            aria-label="Manual file copy"
            readOnly
            value={files[selected]}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
        <div
          className="code-editor"
          role="tabpanel"
          aria-label={`${selected} source`}
          tabIndex={0}
        >
          <pre>
            <code>
              {files[selected].split("\n").map((line, index) => (
                <span className="code-line" key={index}>
                  <span className="line-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>{line || " "}</span>
                </span>
              ))}
            </code>
          </pre>
        </div>
        <div className="code-status">
          <span>
            {selected} · UTF-8 · {files[selected].split("\n").length} lines
          </span>
          <span>Generated locally / no secrets</span>
        </div>
        <div className="package-actions">
          <p role="status">
            {feedback ||
              "Four deliverables + .claspignore. No credentials or deployment IDs included."}
          </p>
          <button
            className="primary-button"
            onClick={download}
            disabled={downloading || checks.some((check) => !check.pass)}
          >
            <Download size={14} />
            {downloading
              ? "Building ZIP…"
              : "Download Full Clasp Bundle (.zip)"}
          </button>
        </div>
      </section>
      <aside className="package-sidebar">
        <section className="panel">
          <PanelHeading
            icon={ShieldCheck}
            title="Security linter"
            subtitle="Manifest + generated-code static checks"
            trailing={
              <span className="mono small text-green">
                {checks.filter((c) => c.pass).length}/{checks.length}
              </span>
            }
          />
          <div className="security-checks">
            {checks.map((check) => (
              <div
                key={check.label}
                className={
                  check.pass ? "security-check passed" : "security-check failed"
                }
              >
                {check.pass ? <Check size={14} /> : <TriangleAlert size={14} />}
                <div>
                  <strong>{check.label}</strong>
                  <p>{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="security-caveat">
            <TriangleAlert size={15} />
            <div>
              <strong>Scope capability ≠ code policy</strong>
              <p>
                gmail.compose permits sending. This package calls Drafts.create
                only. Excluding gmail.send alone is not an OAuth no-send
                guarantee.
              </p>
              <a
                href="https://developers.google.com/workspace/gmail/api/auth/scopes"
                target="_blank"
                rel="noreferrer"
              >
                Google scope definitions ↗
              </a>
            </div>
          </div>
        </section>
        <section className="panel handoff-summary">
          <h3>Deployment boundary</h3>
          <ol>
            <li>Client-owned, spreadsheet-bound script</li>
            <li>Configure prefixed Script Properties</li>
            <li>Set timezone and Gmail intake filter</li>
            <li>Test under the office lead's account</li>
            <li>Recreate trigger, remove vendor access</li>
          </ol>
          <p>
            Generated source is inspectable and tested with mocks. Live Google
            authorization and deployment require validation in the client’s
            domain.
          </p>
        </section>
      </aside>
    </div>
  );
}
