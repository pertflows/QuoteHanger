// Bill of materials and estimate for a design. Pure, so the browser and the
// server compute the same numbers from the same layout.

import { PATTERNS, PRODUCTS, type PatternId, type ProductId, type Unit } from "@/config/catalog";
import type { DesignDoc } from "@/lib/design";
import { feet } from "@/lib/geometry";

export interface BomRow {
  /** Product id, or `rgb:<pattern>` so each track pattern gets its own line. */
  key: string;
  product: ProductId;
  pattern: PatternId | null;
  name: string;
  unit: Unit;
  /** Whole feet for per-foot products (rounded per row), count for per-each. */
  qty: number;
  rate: number;
  cost: number;
}

export interface Estimate {
  rows: BomRow[];
  /** Total feet of lights across per-foot rows. */
  feet: number;
  /** Count of per-each pieces (wreaths, uplights). */
  accents: number;
  total: number;
  scaleSource: DesignDoc["scaleSource"];
}

export function estimate(design: Pick<DesignDoc, "pxPerFt" | "scaleSource" | "strands" | "items">): Estimate {
  const acc = new Map<string, { product: ProductId; pattern: PatternId | null; raw: number }>();
  const add = (key: string, product: ProductId, pattern: PatternId | null, n: number) => {
    const row = acc.get(key) ?? { product, pattern, raw: 0 };
    row.raw += n;
    acc.set(key, row);
  };

  for (const s of design.strands) {
    const isRgb = PRODUCTS[s.product].kind === "rgb";
    const pattern = isRgb ? s.pattern : null;
    add(isRgb ? `${s.product}:${pattern}` : s.product, s.product, pattern, feet(s.pts, design.pxPerFt));
  }
  for (const it of design.items) add(it.product, it.product, null, 1);

  let total = 0;
  let ft = 0;
  let accents = 0;
  const rows: BomRow[] = [];
  for (const [key, r] of acc) {
    const P = PRODUCTS[r.product];
    const qty = P.unit === "each" ? r.raw : Math.round(r.raw);
    const cost = qty * P.rate;
    total += cost;
    if (P.unit === "each") accents += qty;
    else ft += qty;
    const name = r.pattern ? `${P.name} (${PATTERNS[r.pattern].label.toLowerCase()})` : P.name;
    rows.push({ key, product: r.product, pattern: r.pattern, name, unit: P.unit, qty, rate: P.rate, cost });
  }

  return { rows, feet: ft, accents, total, scaleSource: design.scaleSource };
}
