import { describe, expect, it } from "vitest";
import { parseLead } from "@/lib/lead";

const validDesign = {
  photo: { w: 1600, h: 1000 },
  pxPerFt: 10,
  scaleSource: "user",
  strands: [{ id: 1, product: "c9warm", pts: [[0, 0], [100, 0]], pattern: null }],
  items: [{ id: 2, product: "wreath", x: 50, y: 50 }],
};
const contact = { name: "Pat", email: "pat@example.com", phone: "" };

describe("lead intake", () => {
  it("recomputes the estimate on the server", () => {
    const lead = parseLead({ contact, design: validDesign, estimate: { total: 1 } });
    if (typeof lead === "string") throw new Error(lead);
    expect(lead.estimate.total).toBe(10 * 4.5 + 95);
    expect(lead.clientTotalMismatch).toBe(true);
  });

  it("rejects unknown products, bad emails and misplaced kinds", () => {
    expect(parseLead({ contact: { ...contact, email: "nope" }, design: validDesign })).toMatch(/email/);
    expect(
      parseLead({ contact, design: { ...validDesign, strands: [{ id: 1, product: "laser", pts: [[0, 0], [1, 1]] }] } }),
    ).toMatch(/product/);
    expect(
      parseLead({ contact, design: { ...validDesign, items: [{ id: 3, product: "c9warm", x: 0, y: 0 }] } }),
    ).toMatch(/not a placed item/);
    expect(
      parseLead({ contact, design: { ...validDesign, strands: [{ id: 1, product: "rgb", pts: [[0, 0], [1, 1]] }] } }),
    ).toMatch(/pattern/);
  });
});
