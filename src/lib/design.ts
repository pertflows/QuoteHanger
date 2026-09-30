// The design document: what the homeowner drew, in image-pixel space. This is
// the shape that becomes the `designs.layout` JSON column (HANDOFF.md §5).

import {
  isPatternId,
  isProductId,
  PRODUCTS,
  isLineProduct,
  type PatternId,
  type ProductId,
} from "@/config/catalog";
import type { Pt } from "@/lib/geometry";

export type ScaleSource = "user" | "estimated";

export interface Strand {
  id: number;
  product: ProductId;
  pts: Pt[];
  /** Only set for the RGB track; null for everything else. */
  pattern: PatternId | null;
}

export interface Item {
  id: number;
  product: ProductId;
  x: number;
  y: number;
}

export interface DesignDoc {
  photo: { w: number; h: number };
  pxPerFt: number;
  scaleSource: ScaleSource;
  strands: Strand[];
  items: Item[];
}

export const LIMITS = {
  maxStrands: 500,
  maxItems: 500,
  maxPointsPerStrand: 1000,
  maxPhotoSide: 10000,
} as const;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parsePt(v: unknown): Pt | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [x, y] = v as unknown[];
  return finite(x) && finite(y) ? [x, y] : null;
}

/**
 * Validates untrusted input (for example, a lead POSTed from the browser)
 * and returns a clean DesignDoc, or a string describing the first problem.
 */
export function parseDesign(input: unknown): DesignDoc | string {
  if (!input || typeof input !== "object") return "design must be an object";
  const d = input as Record<string, unknown>;

  const photo = d.photo as Record<string, unknown> | undefined;
  if (!photo || !finite(photo.w) || !finite(photo.h)) return "photo.w and photo.h are required";
  if (photo.w <= 0 || photo.h <= 0 || photo.w > LIMITS.maxPhotoSide || photo.h > LIMITS.maxPhotoSide)
    return "photo size out of range";
  if (!finite(d.pxPerFt) || d.pxPerFt <= 0) return "pxPerFt must be a positive number";
  if (d.scaleSource !== "user" && d.scaleSource !== "estimated")
    return 'scaleSource must be "user" or "estimated"';
  if (!Array.isArray(d.strands) || d.strands.length > LIMITS.maxStrands) return "strands invalid";
  if (!Array.isArray(d.items) || d.items.length > LIMITS.maxItems) return "items invalid";

  const strands: Strand[] = [];
  for (const raw of d.strands as unknown[]) {
    const s = raw as Record<string, unknown>;
    if (!s || !finite(s.id) || !isProductId(s.product)) return "strand has a bad id or product";
    if (!isLineProduct(PRODUCTS[s.product])) return `${s.product} is not a strand product`;
    if (!Array.isArray(s.pts) || s.pts.length < 2 || s.pts.length > LIMITS.maxPointsPerStrand)
      return "strand needs 2 or more points";
    const pts: Pt[] = [];
    for (const p of s.pts as unknown[]) {
      const q = parsePt(p);
      if (!q) return "strand point is invalid";
      pts.push(q);
    }
    let pattern: PatternId | null = null;
    if (PRODUCTS[s.product].kind === "rgb") {
      if (!isPatternId(s.pattern)) return "RGB strand needs a pattern";
      pattern = s.pattern;
    }
    strands.push({ id: s.id, product: s.product, pts, pattern });
  }

  const items: Item[] = [];
  for (const raw of d.items as unknown[]) {
    const it = raw as Record<string, unknown>;
    if (!it || !finite(it.id) || !isProductId(it.product)) return "item has a bad id or product";
    if (isLineProduct(PRODUCTS[it.product])) return `${it.product} is not a placed item`;
    if (!finite(it.x) || !finite(it.y)) return "item position is invalid";
    items.push({ id: it.id, product: it.product, x: it.x, y: it.y });
  }

  return {
    photo: { w: photo.w, h: photo.h },
    pxPerFt: d.pxPerFt,
    scaleSource: d.scaleSource,
    strands,
    items,
  };
}
