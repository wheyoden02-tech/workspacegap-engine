"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, SlidersHorizontal, X } from "lucide-react";
import {
  editions,
  normalizeConfig,
  validateConfig,
  type ClientConfig,
} from "@/lib/client-config";
export function ClientBuilder({
  config,
  onGenerate,
  onClose,
}: {
  config: ClientConfig;
  onGenerate: (config: ClientConfig) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ClientConfig>(config);
  const [errors, setErrors] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="client-builder"
      aria-labelledby="builder-title"
      onCancel={onClose}
    >
      <header>
        <div>
          <SlidersHorizontal size={16} />
          <h2 id="builder-title">Custom client builder</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close client builder"
        >
          <X size={17} />
        </button>
      </header>
      <div className="builder-intro">
        <span className="eyebrow">THE FOUR PLAY INPUTS</span>
        <p>
          Describe the workflow. Generate a client-specific code package without
          connecting an account.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = normalizeConfig(form);
          const errors = validateConfig(value);
          setErrors(errors);
          if (!errors.length) onGenerate(value);
        }}
      >
        <label>
          Company type
          <input
            autoFocus
            required
            maxLength={180}
            value={form.companyType}
            placeholder="HVAC & Plumbing Contractor"
            onChange={(e) => setForm({ ...form, companyType: e.target.value })}
          />
          <small>
            Used as the package identity and Script Property prefix.
          </small>
        </label>
        <label>
          Tools they pay for
          <input
            required
            maxLength={180}
            value={form.tools}
            placeholder="Jobber, Typeform, DocuSign"
            onChange={(e) => setForm({ ...form, tools: e.target.value })}
          />
          <small>Comma-separated. Unknown tools remain unverified.</small>
        </label>
        <label>
          The sheet someone updates by hand
          <input
            required
            maxLength={180}
            value={form.sheetName}
            placeholder="Weekly Open Quotes & Dispatch Tracker"
            onChange={(e) => setForm({ ...form, sheetName: e.target.value })}
          />
        </label>
        <label>
          Workspace edition
          <select
            value={form.edition}
            onChange={(e) =>
              setForm({
                ...form,
                edition: e.target.value as ClientConfig["edition"],
              })
            }
          >
            {editions.map((edition) => (
              <option key={edition}>{edition}</option>
            ))}
          </select>
          <small>
            Paid editions share Google's published Apps Script quota category.
            Trial limits can differ.
          </small>
        </label>
        {errors.length > 0 && (
          <div role="alert" className="form-errors">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
        <button type="submit" className="primary-button">
          Generate Custom Workspace Package <ArrowRight size={14} />
        </button>
      </form>
      <div className="builder-note">
        No domain, password, token, or spreadsheet credentials requested. All
        four inputs remain in this browser session.
      </div>
    </dialog>
  );
}
