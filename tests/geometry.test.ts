import { describe, expect, it } from "vitest";
import { feet, polyLen, sampleAlong, type BulbPos, type Pt } from "@/lib/geometry";

describe("footage from pxPerFt", () => {
  it("is the summed segment length divided by pxPerFt", () => {
    // 3-4-5 triangle legs: 30 px + 40 px = 70 px of line
    const pts: Pt[] = [[0, 0], [30, 0], [30, 40]];
    expect(polyLen(pts)).toBe(70);
    expect(feet(pts, 10)).toBe(7);
    expect(feet(pts, 15.5)).toBeCloseTo(70 / 15.5, 10);
  });

  it("measures diagonals by true length", () => {
    expect(feet([[0, 0], [30, 40]], 5)).toBe(10);
  });

  it("changes inversely with the scale", () => {
    const pts: Pt[] = [[100, 100], [400, 100]];
    expect(feet(pts, 10)).toBe(30);
    expect(feet(pts, 20)).toBe(15);
  });

  it("is zero for a single point, no points, or an unset scale", () => {
    expect(feet([[5, 5]], 10)).toBe(0);
    expect(feet([], 10)).toBe(0);
    expect(feet([[0, 0], [10, 0]], 0)).toBe(0);
  });

  it("matches the sample-house eave at 15.5 px/ft", () => {
    // Lower eave on the sample house: 676 px wide ≈ 43.6 ft
    expect(Math.round(feet([[512, 425], [1188, 425]], 15.5))).toBe(44);
  });
});

/** Distance along the polyline from its start to point q (q assumed on the line). */
function arcPos(pts: Pt[], q: BulbPos): number {
  let acc = 0;
  let best = { d: Infinity, s: 0 };
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const L = Math.hypot(x1 - x0, y1 - y0);
    const t = Math.max(0, Math.min(1, ((q.x - x0) * (x1 - x0) + (q.y - y0) * (y1 - y0)) / (L * L)));
    const d = Math.hypot(q.x - (x0 + t * (x1 - x0)), q.y - (y0 + t * (y1 - y0)));
    if (d < best.d - 1e-9) best = { d, s: acc + t * L };
    acc += L;
  }
  return best.s;
}

describe("even bulb spacing across corners", () => {
  it("starts at the first vertex and spaces bulbs evenly on a straight line", () => {
    const b = sampleAlong([[0, 0], [100, 0]], 25);
    expect(b.map((q) => q.x)).toEqual([0, 25, 50, 75, 100]);
    expect(b.every((q) => q.y === 0)).toBe(true);
  });

  it("carries the leftover distance around a right-angle corner", () => {
    // 25 px along x, then down. Step 10: bulbs at 0,10,20 on the first leg;
    // 5 px remain, so the next bulb is 5 px down the second leg, not at the corner.
    const b = sampleAlong([[0, 0], [25, 0], [25, 30]], 10);
    expect(b).toHaveLength(6);
    expect(b[3]!.x).toBeCloseTo(25);
    expect(b[3]!.y).toBeCloseTo(5);
    expect(b[4]!.y).toBeCloseTo(15);
    expect(b[5]!.y).toBeCloseTo(25);
  });

  it("keeps the along-the-line gap constant over a multi-corner roofline", () => {
    const roof: Pt[] = [[510, 421], [620, 281], [1080, 281], [1190, 421]];
    const step = 15.5; // 1 ft at the sample scale
    const b = sampleAlong(roof, step);
    const s = b.map((q) => arcPos(roof, q));
    for (let i = 1; i < s.length; i++) expect(s[i]! - s[i - 1]!).toBeCloseTo(step, 6);
    expect(b).toHaveLength(Math.floor(polyLen(roof) / step) + 1);
  });

  it("carries across several short segments shorter than one step", () => {
    const zig: Pt[] = [[0, 0], [4, 0], [4, 4], [8, 4], [8, 8], [12, 8]];
    const b = sampleAlong(zig, 5);
    const s = b.map((q) => arcPos(zig, q));
    expect(s.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 5, 10, 15, 20]);
  });

  it("skips zero-length segments (double-clicked points)", () => {
    const b = sampleAlong([[0, 0], [10, 0], [10, 0], [20, 0]], 5);
    expect(b.map((q) => q.x)).toEqual([0, 5, 10, 15, 20]);
  });

  it("handles degenerate input", () => {
    expect(sampleAlong([], 5)).toEqual([]);
    expect(sampleAlong([[3, 4]], 5)).toEqual([{ x: 3, y: 4 }]);
    expect(sampleAlong([[0, 0], [10, 0]], 0)).toEqual([]);
  });
});
