export const editions = [
  "Business Starter",
  "Business Standard",
  "Business Plus",
  "Enterprise",
] as const;
export type Edition = (typeof editions)[number];
export type ClientConfig = {
  companyType: string;
  tools: string;
  sheetName: string;
  edition: Edition;
};
export const sampleConfig: ClientConfig = {
  companyType: "GreenScape Landscaping LLC",
  tools: "Form Builder, Scheduling Tool, E-Signature Tool",
  sheetName: "GreenScape Quote Pipeline",
  edition: "Business Standard",
};
export function clientPrefix(config: ClientConfig): string {
  if (config.companyType === sampleConfig.companyType) return "GREENSCAPE";
  const name = config.companyType
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[A-Z]/.test(name) ? name : `CLIENT_${name || "WORKSPACE"}`;
}
export function normalizeConfig(config: ClientConfig): ClientConfig {
  return {
    companyType: config.companyType.trim(),
    tools: config.tools.trim(),
    sheetName: config.sheetName.trim(),
    edition: config.edition,
  };
}
export function validateConfig(config: ClientConfig): string[] {
  const errors: string[] = [];
  for (const [label, value] of [
    ["Company type", config.companyType],
    ["Tools they pay for", config.tools],
    ["The sheet someone updates by hand", config.sheetName],
  ]) {
    if (!value.trim()) errors.push(`${label} is required.`);
    if (value.length > 180)
      errors.push(`${label} must be 180 characters or fewer.`);
    if (/[\r\n\u0000-\u001f]/.test(value))
      errors.push(`${label} must be a single line.`);
  }
  if (!editions.includes(config.edition))
    errors.push("Select a supported Workspace edition.");
  if (
    config.sheetName.trim().length > 100 ||
    /[\[\]:*?/\\]/.test(config.sheetName)
  )
    errors.push(
      "Sheet name must be at most 100 characters and exclude [ ] : * ? / \\.",
    );
  if (config.sheetName.trim().toLowerCase() === "quarantine")
    errors.push(
      "Quarantine is reserved for invalid intake. Choose a different tracker name.",
    );
  return errors;
}
export type Overlap = {
  name: string;
  native: string;
  decision: "Candidate" | "Retain" | "Review";
  reason: string;
  cost?: number;
};
export function toolOverlap(config: ClientConfig): Overlap[] {
  return config.tools
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .filter(
      (name, i, list) =>
        list.findIndex((n) => n.toLowerCase() === name.toLowerCase()) === i,
    )
    .map((name) => {
      if (/sign|docusign|adobe|pandadoc/i.test(name))
        return {
          name,
          native: "Retain specialist tool",
          decision: "Retain",
          reason:
            "Legally binding workflows need fit-for-purpose identity, evidence, and compliance review.",
          cost: config === sampleConfig ? 35 : undefined,
        };
      if (/form|typeform|jotform|tally/i.test(name))
        return {
          name,
          native: "Forms / Gmail + Apps Script",
          decision: "Candidate",
          reason:
            "Basic intake and routing overlap. Validate design, integrations, and upkeep before cancellation.",
          cost: config === sampleConfig ? 49 : undefined,
        };
      if (/schedul|calendly|acuity/i.test(name))
        return {
          name,
          native: "Google Calendar",
          decision: "Candidate",
          reason:
            "Check edition entitlement, routing, reminders, and team availability requirements.",
          cost: config === sampleConfig ? 29 : undefined,
        };
      return {
        name,
        native: "Workflow discovery required",
        decision: "Review",
        reason: /jobber|servicetitan|housecall/i.test(name)
          ? "Dispatch, invoicing, payments, and field operations exceed this quote-intake package."
          : "No verified feature overlap. Capture requirements before recommending replacement.",
      };
    });
}
// Google publishes a paid Workspace category, not a separate quota for each paid edition.
export function quotaProfile(edition: Edition) {
  return {
    edition,
    executionSeconds: 360,
    triggerSecondsDaily: 21600,
    emailReadWriteDaily: 50000,
    propertyOperationsDaily: 500000,
    verifiedOn: "2026-11-14",
  };
}
