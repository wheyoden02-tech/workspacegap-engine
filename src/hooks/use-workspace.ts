"use client";
import { useEffect, useRef, useState } from "react";
import {
  incomingEmails,
  validateEmail,
  createArtifacts,
  type SheetRow,
  type Draft,
  type BadRow,
  type LogEntry,
} from "@/data/sampleWorkspace";

export function useWorkspace() {
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(0);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [badRows, setBadRows] = useState<BadRow[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [runCount, setRunCount] = useState(0);
  const [runtime, setRuntime] = useState("0.0");
  const [duplicates, setDuplicates] = useState(0);
  const [totalRuntime, setTotalRuntime] = useState(0);
  const [emailOperations, setEmailOperations] = useState(0);
  const processed = useRef(new Set<string>());
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const log = (level: LogEntry["level"], message: string) =>
    setLogs((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        time: new Date().toLocaleTimeString("en-GB"),
        level,
        message,
      },
    ]);
  const pause = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  function reset() {
    if (busy.current) return;
    processed.current.clear();
    setLoaded(false);
    setRows([]);
    setDrafts([]);
    setBadRows([]);
    setStage(0);
    setRunCount(0);
    setRuntime("0.0");
    setDuplicates(0);
    setTotalRuntime(0);
    setEmailOperations(0);
    setLogs([]);
  }
  function load() {
    if (busy.current) return;
    reset();
    setLoaded(true);
    log(
      "success",
      "Sandbox loaded · 5 incoming emails · no Google connection.",
    );
    log("info", "Safety policy active: draft-only. All sends are simulated.");
  }
  async function run() {
    if (!loaded || busy.current) return;
    busy.current = true;
    setRunning(true);
    setDuplicates(0);
    setStage(1);
    const start = performance.now();
    try {
      log("info", "08:00 trigger started · acquired execution lock.");
      await pause(450);
      if (!alive.current) return;
      let skipped = 0;
      let added = 0;
      setStage(2);
      for (const [index, email] of incomingEmails.entries()) {
        if (processed.current.has(email.id)) {
          skipped++;
          log("warn", `${email.id} already processed · duplicate prevented.`);
          continue;
        }
        const errors = validateEmail(email);
        if (errors.length) {
          setBadRows((prev) => [...prev, { email, errors }]);
          log(
            "warn",
            `${email.id} quarantined · missing contact / invalid date.`,
          );
        } else {
          const { row, draft } = createArtifacts(email, index);
          setRows((prev) => [...prev, row]);
          await pause(180);
          if (!alive.current) return;
          setDrafts((prev) => [...prev, draft]);
          added++;
          log(
            "success",
            `${row.id} appended · ${draft.id} saved for human review.`,
          );
        }
        processed.current.add(email.id);
      }
      setStage(3);
      await pause(250);
      if (!alive.current) return;
      setDuplicates(skipped);
      const elapsed = (performance.now() - start) / 1000;
      setRuntime(elapsed.toFixed(1));
      setTotalRuntime((previous) => previous + elapsed);
      setEmailOperations(
        (previous) => previous + 1 + incomingEmails.length - skipped + added,
      );
      setRunCount((prev) => prev + 1);
      log(
        "success",
        `Complete · ${added} new rows · ${added} drafts · ${skipped} duplicates blocked. Lock released.`,
      );
      setStage(4);
      return true;
    } catch {
      if (alive.current)
        log("error", "Execution failed. Review reserved rows before retrying.");
      return false;
    } finally {
      if (alive.current) setRunning(false);
      busy.current = false;
    }
  }
  function simulateSend(id: string) {
    if (busy.current) return;
    const draft = drafts.find((item) => item.id === id);
    if (!draft || draft.sent) return;
    setDrafts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, sent: true } : item)),
    );
    setRows((prev) =>
      prev.map((row) =>
        row.id === draft.rowId
          ? {
              ...row,
              status: "Simulated sent",
              last_action: "Human-approved simulation",
            }
          : row,
      ),
    );
    log(
      "success",
      `${id} human-approved · simulated send only · no email delivered.`,
    );
  }
  return {
    loaded,
    running,
    stage,
    rows,
    drafts,
    badRows,
    logs,
    runCount,
    runtime,
    duplicates,
    totalRuntime,
    emailOperations,
    load,
    reset,
    run,
    simulateSend,
  };
}
