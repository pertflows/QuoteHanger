import { NextResponse } from "next/server";
import { parseLead } from "@/lib/lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

// For now a lead is only written to the server log. Storage, notifications
// and the contractor webhook come with the database (HANDOFF.md, M1).
export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "Design is too large" }, { status: 413 });

  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES)
    return NextResponse.json({ error: "Design is too large" }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const lead = parseLead(body);
  if (typeof lead === "string") return NextResponse.json({ error: lead }, { status: 400 });

  console.log(JSON.stringify({ event: "lead.received", lead }));

  return NextResponse.json(
    { ok: true, estimate: { total: lead.estimate.total, feet: lead.estimate.feet } },
    { status: 201 },
  );
}
