import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/config/catalog";
import type { DesignDoc, Item, Strand } from "@/lib/design";
import { estimate } from "@/lib/estimate";

const PPF = 10; // 10 px per ft keeps the arithmetic readable

let nextId = 1;
const line = (product: Strand["product"], lengthFt: number, pattern: Strand["pattern"] = null): Strand => ({
  id: nextId++,
  product,
  pts: [[0, 0], [lengthFt * PPF, 0]],
  pattern,
});
const item = (product: Item["product"]): Item => ({ id: nextId++, product, x: 0, y: 0 });
const design = (strands: Strand[], items: Item[] = []): DesignDoc => ({
  photo: { w: 1600, h: 1000 },
  pxPerFt: PPF,
  scaleSource: "user",
  strands,
  items,
});

describe("bill of materials", () => {
  it("is empty and $0 for an empty design", () => {
    const e = estimate(design([]));
    expect(e.rows).toEqual([]);
    expect(e.total).toBe(0);
    expect(e.feet).toBe(0);
    expect(e.accents).toBe(0);
  });

  it("merges strands of the same product and prices feet times rate", () => {
    const e = estimate(design([line("c9warm", 40), line("c9warm", 20)]));
    expect(e.rows).toHaveLength(1);
    expect(e.rows[0]).toMatchObject({ product: "c9warm", qty: 60, unit: "ft", cost: 60 * PRODUCTS.c9warm.rate });
    expect(e.total).toBe(270);
    expect(e.feet).toBe(60);
  });

  it("rounds footage per row, after summing strands", () => {
    // 10.4 + 10.4 = 20.8 → 21 ft (rounding each strand first would give 20)
    const e = estimate(design([line("mini", 10.4), line("mini", 10.4)]));
    expect(e.rows[0]!.qty).toBe(21);
    expect(e.total).toBe(21 * PRODUCTS.mini.rate);
  });

  it("gives each RGB pattern its own line", () => {
    const e = estimate(design([line("rgb", 10, "candy"), line("rgb", 5, "rainbow"), line("rgb", 2, "candy")]));
    const byKey = Object.fromEntries(e.rows.map((r) => [r.key, r]));
    expect(byKey["rgb:candy"]!.qty).toBe(12);
    expect(byKey["rgb:rainbow"]!.qty).toBe(5);
    expect(byKey["rgb:candy"]!.name).toBe("Permanent RGB track (candy cane)");
    expect(e.total).toBe(17 * PRODUCTS.rgb.rate);
  });

  it("counts wreaths and uplights per each, and leaves them out of the footage", () => {
    const e = estimate(design([line("icicle", 30)], [item("wreath"), item("spot"), item("spot")]));
    const byKey = Object.fromEntries(e.rows.map((r) => [r.key, r]));
    expect(byKey.wreath).toMatchObject({ qty: 1, unit: "each", cost: 95 });
    expect(byKey.spot).toMatchObject({ qty: 2, unit: "each", cost: 140 });
    expect(e.feet).toBe(30);
    expect(e.accents).toBe(3);
    expect(e.total).toBe(30 * 5.5 + 95 + 140);
  });

  it("total equals the sum of the row costs", () => {
    const e = estimate(
      design(
        [line("c9warm", 33.3), line("c9multi", 12.6), line("mini", 48.2), line("icicle", 21), line("rgb", 7.5, "warm")],
        [item("wreath"), item("spot")],
      ),
    );
    expect(e.total).toBeCloseTo(e.rows.reduce((a, r) => a + r.cost, 0), 10);
    expect(e.feet).toBe(e.rows.filter((r) => r.unit === "ft").reduce((a, r) => a + r.qty, 0));
  });

  it("halves the footage and price when the scale doubles", () => {
    const d = design([line("c9warm", 40)]);
    const doubled = { ...d, pxPerFt: PPF * 2 };
    expect(estimate(doubled).feet).toBe(20);
    expect(estimate(doubled).total).toBe(estimate(d).total / 2);
  });

  it("carries the scale source through so estimated quotes can say so", () => {
    expect(estimate({ ...design([]), scaleSource: "estimated" }).scaleSource).toBe("estimated");
  });
});
