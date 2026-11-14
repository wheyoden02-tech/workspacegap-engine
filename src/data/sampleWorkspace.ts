export const company = {
  name: "GreenScape Landscaping LLC",
  owner: "Janet",
  domain: "greenscape.example",
  plan: "Google Workspace Business Standard",
  mx: "aspmx.l.google.com",
};

export const paidTools = [
  {
    name: "Form Builder",
    cost: 49,
    native: "Gmail + Apps Script",
    covered: true,
    detail:
      "Structured quote intake, validation, and routing. Custom form styling needs development.",
  },
  {
    name: "Scheduling Tool",
    cost: 29,
    native: "Google Calendar",
    covered: true,
    detail:
      "Native appointment scheduling covers basic booking. Advanced routing and team scheduling may need a paid tool.",
  },
  {
    name: "E-Signature Tool",
    cost: 35,
    native: "Keep the paid tool",
    covered: false,
    detail:
      "Paid tool still better for legally binding signatures, with purpose-built identity verification and audit trails.",
  },
] as const;

export type IncomingEmail = {
  id: string;
  customer: string;
  contact: string;
  request: string;
  due_on: string;
  created_at: string;
};
export const incomingEmails: IncomingEmail[] = [
  {
    id: "MSG-1041",
    customer: "Alex Morgan",
    contact: "alex@example.com",
    request: "Patio stone installation",
    due_on: "2026-11-20",
    created_at: "2026-11-14T07:12:00",
  },
  {
    id: "MSG-1042",
    customer: "Sarah Chen",
    contact: "sarah@example.com",
    request: "Backyard grading",
    due_on: "2026-11-23",
    created_at: "2026-11-14T07:24:00",
  },
  {
    id: "MSG-1043",
    customer: "James Wilson",
    contact: "james@example.com",
    request: "Seasonal lawn care",
    due_on: "2026-11-18",
    created_at: "2026-11-14T07:36:00",
  },
  {
    id: "MSG-1044",
    customer: "Maria Garcia",
    contact: "maria@example.com",
    request: "Retaining wall",
    due_on: "2026-11-25",
    created_at: "2026-11-14T07:48:00",
  },
  {
    id: "MSG-1045",
    customer: "Unknown customer",
    contact: "",
    request: "Corrupted website submission",
    due_on: "next-friday-ish",
    created_at: "2026-11-14T07:55:00",
  },
];
export type SheetRow = {
  id: string;
  created_at: string;
  customer: string;
  request: string;
  owner: string;
  status: "Draft ready" | "Simulated sent";
  due_on: string;
  last_action: string;
  sourceId: string;
};
export type Draft = {
  id: string;
  rowId: string;
  to: string;
  customer: string;
  subject: string;
  body: string;
  sent: boolean;
};
export type BadRow = { email: IncomingEmail; errors: string[] };
export type LogEntry = {
  id: number;
  time: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
};

export function validateEmail(email: IncomingEmail): string[] {
  const errors: string[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.contact))
    errors.push("Missing or invalid customer contact");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(email.due_on) ||
    Number.isNaN(Date.parse(email.due_on)) ||
    new Date(email.due_on).toISOString().slice(0, 10) !== email.due_on
  )
    errors.push("Invalid due_on: expected YYYY-MM-DD");
  return errors;
}
export function createArtifacts(
  email: IncomingEmail,
  index: number,
): { row: SheetRow; draft: Draft } {
  const id = `Q-${1041 + index}`;
  return {
    row: {
      id,
      created_at: email.created_at,
      customer: email.customer,
      request: email.request,
      owner: "Janet",
      status: "Draft ready",
      due_on: email.due_on,
      last_action: "Reply drafted",
      sourceId: email.id,
    },
    draft: {
      id: `DFT-${1041 + index}`,
      rowId: id,
      to: email.contact,
      customer: email.customer,
      subject: `Your quote request: ${email.request}`,
      body: `Hi ${email.customer.split(" ")[0]},\n\nThanks for reaching out to GreenScape Landscaping! We received your request for ${email.request.toLowerCase()} with a requested date of ${email.due_on}.\n\nJanet will review the details and follow up to arrange a site visit. Your requested date is subject to availability; no appointment is booked yet.\n\nBest,\nJanet\nGreenScape Landscaping LLC`,
      sent: false,
    },
  };
}
