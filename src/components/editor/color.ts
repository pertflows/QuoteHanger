export type RGB = [number, number, number];

export function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear blend of two hex colors, as an rgb() string. */
export function mix(a: string, b: string, t: number): string {
  const A = hex(a);
  const B = hex(b);
  return "rgb(" + A.map((v, i) => Math.round(v + (B[i]! - v) * t)).join(",") + ")";
}

/** Saturated color for a hue in degrees, as #rrggbb. */
export function hueHex(h: number): string {
  h = ((h % 360) + 360) % 360;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = 0.6 - 0.4 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255);
  };
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
