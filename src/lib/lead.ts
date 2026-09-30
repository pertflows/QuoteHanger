// Lead intake: validates what the widget POSTs and builds the record the
// contractor receives. The estimate is recomputed from the layout with the
// server's catalog, so a tampered client total never reaches the contractor.

import { parseDesign, type DesignDoc } from "@/lib/design";
import { estimate, type Estimate } from "@/lib/estimate";

export interface Contact {
  name: string;
  email: string;
  phone: string;
}

export interface Lead {
  receivedAt: string;
  contact: Contact;
  design: DesignDoc;
  estimate: Estimate;
  /** True when the browser's total disagreed with the server's. */
  clientTotalMismatch: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length <= max ? s : null;
}

export function parseLead(input: unknown, now = new Date()): Lead | string {
  if (!input || typeof input !== "object") return "body must be a JSON object";
  const body = input as Record<string, unknown>;

  const c = (body.contact ?? {}) as Record<string, unknown>;
  const name = str(c.name, 200);
  const email = str(c.email, 320);
  const phone = c.phone === undefined ? "" : str(c.phone, 50);
  if (!name) return "contact.name is required";
  if (!email || !EMAIL.test(email)) return "contact.email must be a valid email address";
  if (phone === null) return "contact.phone is too long";

  const design = parseDesign(body.design);
  if (typeof design === "string") return design;

  const est = estimate(design);
  const clientTotal = (body.estimate as { total?: unknown } | undefined)?.total;
  const clientTotalMismatch = typeof clientTotal === "number" && Math.round(clientTotal) !== Math.round(est.total);

  return {
    receivedAt: now.toISOString(),
    contact: { name, email, phone },
    design,
    estimate: est,
    clientTotalMismatch,
  };
}
