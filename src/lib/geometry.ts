// Pure geometry helpers. All coordinates are in image-pixel space.

export type Pt = [number, number];

export interface BulbPos {
  x: number;
  y: number;
}

/** Total length of a polyline, in pixels. */
export function polyLen(pts: readonly Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    len += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return len;
}

/** Length of a polyline in feet, given the photo's scale. */
export function feet(pts: readonly Pt[], pxPerFt: number): number {
  if (!(pxPerFt > 0)) return 0;
  return polyLen(pts) / pxPerFt;
}

/**
 * Places points along a polyline every `step` pixels, starting at the first
 * vertex. The distance left over at the end of a segment carries into the
 * next one, so spacing measured along the line stays even across corners.
 */
export function sampleAlong(pts: readonly Pt[], step: number): BulbPos[] {
  const out: BulbPos[] = [];
  if (!pts.length || !(step > 0)) return out;
  if (pts.length === 1) {
    out.push({ x: pts[0]![0], y: pts[0]![1] });
    return out;
  }
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (!len) continue;
    let d = carry;
    while (d <= len) {
      const t = d / len;
      out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
      d += step;
    }
    carry = d - len;
  }
  return out;
}

/** Distance from point (px, py) to segment a–b. */
export function segDist(px: number, py: number, a: Pt, b: Pt): number {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

/** Deterministic hash of two integers to [0, 1). Keeps jitter stable between frames. */
export function rnd(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
