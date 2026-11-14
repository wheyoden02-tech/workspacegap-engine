import {
  ArrowUpRight,
  BriefcaseBusiness,
  Code2,
  Globe,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { type ClientConfig, toolOverlap } from "@/lib/client-config";
import { Badge, PanelHeading } from "./ui";

export function AuditPanel({
  config,
  sample,
}: {
  config: ClientConfig;
  sample: boolean;
}) {
  const tools = toolOverlap(config);
  return (
    <div className="discovery-layout">
      <section className="panel">
        <PanelHeading
          icon={ScanLine}
          title="Public signals"
          subtitle="Step 01 / Establish the existing stack"
          trailing={
            <span className="muted small">
              {sample ? "FIXTURE EVIDENCE" : "UNVERIFIED CLIENT"}
            </span>
          }
        />
        <div className="signal-grid">
          <article>
            <div className="signal-title">
              <Globe size={16} />
              <h3>DNS / MX records</h3>
              <Badge tone={sample ? "cyan" : "slate"}>
                {sample ? "Verified sample" : "Not checked"}
              </Badge>
            </div>
            <code>{sample ? "aspmx.l.google.com" : "No domain supplied"}</code>
            <p>
              {sample
                ? "Sample record indicates Google-hosted mail. It does not establish edition, admin rights, or feature availability."
                : "The four builder inputs do not include a domain. Verify public MX records during discovery."}
            </p>
          </article>
          <article>
            <div className="signal-title">
              <BriefcaseBusiness size={16} />
              <h3>Careers & job posts</h3>
              <Badge>{sample ? "Sample signal" : "Needs evidence"}</Badge>
            </div>
            <strong>
              {sample
                ? "Office coordinator · scheduling & quotes"
                : "Tool mentions in public roles"}
            </strong>
            <p>
              {sample
                ? "Fixture: office staff copy website enquiries into a tracker and coordinate visits in Calendar."
                : "Capture the post URL, date, and exact tool mention. Do not infer tool usage from company type."}
            </p>
          </article>
          <article>
            <div className="signal-title">
              <Code2 size={16} />
              <h3>Embedded website widgets</h3>
              <Badge>{sample ? "Sample signal" : "Needs inspection"}</Badge>
            </div>
            <strong>
              {sample
                ? "Quote form + appointment widget"
                : "Form actions, scripts & iframes"}
            </strong>
            <p>
              {sample
                ? "Fixture: paid form intake and a separate booking embed. No external website has been scanned."
                : "Inspect public scripts, iframes, and form destinations. A widget is a signal, not proof of a paid plan."}
            </p>
          </article>
        </div>
        <div className="panel-note">
          <ShieldCheck size={14} /> Public-source discovery only. No passwords,
          mailbox access, or admin credentials collected.
        </div>
      </section>
      <section className="panel">
        <PanelHeading
          icon={ScanLine}
          title="Paid tools → native coverage"
          subtitle="Step 02 / Validate workflow fit before replacing a tool"
          trailing={
            <span className="mono muted small">{tools.length} TOOLS</span>
          }
        />
        <div className="matrix-scroll">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Current tool</th>
                <th>Workspace alternative</th>
                <th>Decision</th>
                <th>Trade-off / evidence needed</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.name}>
                  <td>
                    <strong>{tool.name}</strong>
                    {sample && tool.cost !== undefined && (
                      <span className="table-secondary">
                        ${tool.cost}/mo · sample audit
                      </span>
                    )}
                  </td>
                  <td>{tool.native}</td>
                  <td>
                    <Badge
                      tone={
                        tool.decision === "Retain"
                          ? "amber"
                          : tool.decision === "Candidate"
                            ? "green"
                            : "slate"
                      }
                    >
                      {tool.decision}
                    </Badge>
                  </td>
                  <td>{tool.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="decision-note">
          <div>
            <h3>Overlap is a hypothesis. Savings require validation.</h3>
            <p>
              {sample
                ? "$113/mo is the sample audited spend. $78/mo is a potential overlap ceiling; $35/mo for e-signatures is retained. No cancellation or savings are guaranteed."
                : "No prices or savings are invented for custom tools. Validate billed plans, feature parity, implementation, and maintenance with the client."}
            </p>
          </div>
          <a
            href="https://workspace.google.com/pricing.html"
            target="_blank"
            rel="noreferrer"
          >
            Edition entitlements <ArrowUpRight size={13} />
          </a>
        </div>
      </section>
    </div>
  );
}
