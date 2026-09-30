// Plain 2D-canvas renderer for the editor. Everything is drawn in image-pixel
// space; the <canvas> element is sized to the photo and CSS scales it down.
//
// Order: photo → physical objects (wreath greenery, fixtures) → night pass →
// lights in additive ("lighter") mode → editing overlay.

import { PATTERNS, PRODUCTS, type PatternId, type ProductId } from "@/config/catalog";
import type { Item, Strand } from "@/lib/design";
import { rnd, sampleAlong, type Pt } from "@/lib/geometry";
import { hex, hueHex, mix } from "./color";

export type Mode = "draw" | "select" | "scale";
export type Selection = { type: "strand" | "item"; id: number } | null;

export interface Scene {
  W: number;
  H: number;
  bg: CanvasImageSource;
  night: number;
  pxPerFt: number;
  compare: boolean;
  strands: Strand[];
  items: Item[];
  draft: Strand | null;
  cursor: { x: number; y: number } | null;
  mode: Mode;
  sel: Selection;
  scalePts: Pt[] | null;
  reduceMotion: boolean;
}

type Ctx = CanvasRenderingContext2D;

export function bulbRadius(product: ProductId, pxPerFt: number): number {
  const r = PRODUCTS[product].bulbRadiusFt ?? 0.1;
  return Math.max(1.5, Math.min(10, r * pxPerFt));
}

/** Hit radius around a placed item, in image pixels. */
export function itemRadius(it: Item, pxPerFt: number): number {
  const P = PRODUCTS[it.product];
  return P.kind === "wreath" ? ((P.sizeFt ?? 3) / 2) * pxPerFt : 14;
}

/** Visual center of an item (uplights are drawn just above their anchor). */
export function itemCenterY(it: Item): number {
  return PRODUCTS[it.product].kind === "spot" ? it.y - 10 : it.y;
}

export function rgbColor(pattern: PatternId | null, i: number, t: number, reduceMotion: boolean): string {
  const P = PATTERNS[pattern ?? "warm"];
  if (P.colors) return P.colors[i % P.colors.length]!;
  const shift = reduceMotion ? 0 : t * 0.09;
  return hueHex(Math.round((i * 14 + shift) / 15) * 15);
}

export function findSel(scene: Pick<Scene, "sel" | "strands" | "items">): Strand | Item | null {
  const { sel } = scene;
  if (!sel) return null;
  const arr: (Strand | Item)[] = sel.type === "strand" ? scene.strands : scene.items;
  return arr.find((o) => o.id === sel.id) ?? null;
}

export class Renderer {
  // Glow sprites, cached by color and radius.
  private sprites = new Map<string, HTMLCanvasElement>();

  clearCache() {
    this.sprites.clear();
  }

  private sprite(col: string, R: number): HTMLCanvasElement {
    R = Math.max(2, Math.round(R));
    const key = col + "|" + R;
    let s = this.sprites.get(key);
    if (!s) {
      s = document.createElement("canvas");
      s.width = s.height = R * 2;
      const g = s.getContext("2d")!;
      const [r, gg, b] = hex(col);
      const gr = g.createRadialGradient(R, R, 0, R, R, R);
      gr.addColorStop(0, `rgba(${r},${gg},${b},1)`);
      gr.addColorStop(0.15, `rgba(${r},${gg},${b},.5)`);
      gr.addColorStop(0.45, `rgba(${r},${gg},${b},.13)`);
      gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, R * 2, R * 2);
      this.sprites.set(key, s);
    }
    return s;
  }

  private glow(ctx: Ctx, x: number, y: number, col: string, R: number, alpha: number) {
    const s = this.sprite(col, R);
    ctx.globalAlpha = alpha;
    ctx.drawImage(s, x - s.width / 2, y - s.height / 2);
  }

  /** One bulb: optional wall wash, glow, colored core and white hot spot. */
  private bulb(ctx: Ctx, x: number, y: number, r: number, col: string, I: number, wash: boolean) {
    if (wash) this.glow(ctx, x, y + r * 12, col, r * 34, I * 0.07);
    this.glow(ctx, x, y, col, r * 9, Math.min(1, I * 0.95));
    ctx.globalAlpha = Math.min(1, 0.35 + I * 0.8);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = Math.min(1, 0.2 + I * 0.7);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, 7);
    ctx.fill();
  }

  /**
   * Draws the scene. `t` is the animation clock in ms; `k` is image pixels
   * per CSS pixel, so overlay handles stay the same size on screen.
   */
  render(ctx: Ctx, s: Scene, t: number, k: number, opts: { overlay?: boolean } = {}) {
    const { W, H } = s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(s.bg, 0, 0, W, H);
    if (s.compare) return;
    const n = s.night;
    const I = 0.3 + 0.7 * n;
    const ppf = s.pxPerFt;

    // Physical objects darken with the scene.
    for (const it of s.items) {
      const P = PRODUCTS[it.product];
      if (P.kind === "wreath") {
        const R = ((P.sizeFt ?? 3) / 2) * ppf;
        for (let a = 0; a < 24; a++) {
          const an = (a / 24) * Math.PI * 2;
          ctx.fillStyle = a % 2 ? "#1f4a2a" : "#2b5f36";
          ctx.beginPath();
          ctx.arc(it.x + Math.cos(an) * R * 0.8, it.y + Math.sin(an) * R * 0.8, R * 0.28, 0, 7);
          ctx.fill();
        }
        ctx.fillStyle = "#c0262d";
        ctx.beginPath();
        ctx.moveTo(it.x, it.y + R * 0.75);
        ctx.lineTo(it.x - R * 0.4, it.y + R * 0.5);
        ctx.lineTo(it.x - R * 0.4, it.y + R * 1.05);
        ctx.closePath();
        ctx.moveTo(it.x, it.y + R * 0.75);
        ctx.lineTo(it.x + R * 0.4, it.y + R * 0.5);
        ctx.lineTo(it.x + R * 0.4, it.y + R * 1.05);
        ctx.closePath();
        ctx.fill();
      } else if (P.kind === "spot") {
        ctx.fillStyle = "#161616";
        ctx.fillRect(it.x - 6, it.y - 8, 12, 10);
      }
    }

    // Night: multiply by a dark blue, then a dark layer on top.
    if (n > 0) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = mix("#ffffff", "#26325a", n);
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(4,7,18,${n * 0.38})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Light.
    ctx.globalCompositeOperation = "lighter";
    for (const it of s.items) {
      const P = PRODUCTS[it.product];
      if (P.kind === "spot") {
        const R = 4.2 * ppf;
        ctx.save();
        ctx.beginPath();
        ctx.rect(it.x - R * 2, 0, R * 4, it.y + 4);
        ctx.clip();
        ctx.translate(it.x, it.y);
        ctx.scale(1, 2.5);
        const cy = -R * 0.72;
        const g = ctx.createRadialGradient(0, cy, 0, 0, cy, R);
        g.addColorStop(0, "rgba(255,214,150,.42)");
        g.addColorStop(0.6, "rgba(255,200,130,.12)");
        g.addColorStop(1, "rgba(255,200,130,0)");
        ctx.globalAlpha = I;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, cy, R, 0, 7);
        ctx.fill();
        ctx.restore();
        this.glow(ctx, it.x, it.y - 6, "#fff1d6", 10, I);
      } else if (P.kind === "wreath") {
        const R = ((P.sizeFt ?? 3) / 2) * ppf;
        for (let a = 0; a < 22; a++) {
          const an = (a / 22) * Math.PI * 2 + 0.1;
          this.bulb(ctx, it.x + Math.cos(an) * R * 0.8, it.y + Math.sin(an) * R * 0.8, 1.6, "#ffd996", I, false);
        }
      }
    }
    const all = s.draft ? [...s.strands, s.draft] : s.strands;
    for (const st of all) this.drawStrand(ctx, s, st, I, t);

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (opts.overlay !== false) this.drawOverlay(ctx, s, k);
  }

  private drawStrand(ctx: Ctx, s: Scene, st: Strand, I: number, t: number) {
    const P = PRODUCTS[st.product];
    const ppf = s.pxPerFt;
    const r = bulbRadius(st.product, ppf);
    const step = Math.max(r * 2.2, (P.spacingFt ?? 1) * ppf);
    const pts: Pt[] =
      st === s.draft && s.cursor && s.mode === "draw" ? [...st.pts, [s.cursor.x, s.cursor.y]] : st.pts;
    const b = sampleAlong(pts, step);
    const colors = P.colors ?? ["#ffd996"];

    if (P.kind === "icicle") {
      b.forEach((q, i) => {
        const L = (0.5 + rnd(i, st.id) * 1.6) * ppf;
        const dstep = Math.max(r * 2.4, 0.28 * ppf);
        ctx.globalAlpha = 0.25 * I;
        ctx.strokeStyle = "#dfe8ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x, q.y + L);
        ctx.stroke();
        for (let d = 0; d <= L; d += dstep) this.bulb(ctx, q.x, q.y + d, r, colors[0]!, I * 0.45, false);
      });
      return;
    }
    b.forEach((q, i) => {
      let { x, y } = q;
      if (P.jitter) {
        x += (rnd(i, st.id) - 0.5) * r * 5;
        y += (rnd(st.id, i) - 0.5) * r * 5;
      }
      const col = P.kind === "rgb" ? rgbColor(st.pattern, i, t, s.reduceMotion) : colors[i % colors.length]!;
      this.bulb(ctx, x, y, r, col, I, !!P.wash && i % 2 === 0);
    });
  }

  private drawOverlay(ctx: Ctx, s: Scene, k: number) {
    ctx.lineWidth = 1.5 * k;
    const polyline = (pts: Pt[], extra?: { x: number; y: number } | null) => {
      ctx.beginPath();
      ctx.moveTo(pts[0]![0], pts[0]![1]);
      for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]);
      if (extra) ctx.lineTo(extra.x, extra.y);
      ctx.stroke();
    };
    if (s.draft && s.draft.pts.length) {
      ctx.setLineDash([6 * k, 5 * k]);
      ctx.strokeStyle = "rgba(255,198,110,.9)";
      polyline(s.draft.pts, s.cursor);
      ctx.setLineDash([]);
      for (const q of s.draft.pts) this.handle(ctx, q[0], q[1], k, false);
    }
    const o = findSel(s);
    if (o && "pts" in o) {
      ctx.setLineDash([5 * k, 4 * k]);
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      polyline(o.pts);
      ctx.setLineDash([]);
      for (const q of o.pts) this.handle(ctx, q[0], q[1], k, true);
    } else if (o) {
      ctx.setLineDash([5 * k, 4 * k]);
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.beginPath();
      ctx.arc(o.x, itemCenterY(o), itemRadius(o, s.pxPerFt) + 6 * k, 0, 7);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (s.scalePts) {
      const p = s.scalePts;
      const end: Pt = p[1] ?? [s.cursor?.x ?? p[0]![0], s.cursor?.y ?? p[0]![1]];
      ctx.strokeStyle = "#f3a95c";
      ctx.lineWidth = 3 * k;
      ctx.beginPath();
      ctx.moveTo(p[0]![0], p[0]![1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
      for (const q of p) {
        ctx.fillStyle = "#f3a95c";
        ctx.beginPath();
        ctx.arc(q[0], q[1], 5 * k, 0, 7);
        ctx.fill();
      }
    }
  }

  private handle(ctx: Ctx, x: number, y: number, k: number, white: boolean) {
    ctx.fillStyle = white ? "#ffffff" : "#ffc66e";
    ctx.strokeStyle = "#0c1220";
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.arc(x, y, 5.5 * k, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
}
