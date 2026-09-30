// Small preview images for the product buttons, drawn on a canvas.

import { PRODUCTS, type ProductId } from "@/config/catalog";

export function swatch(id: ProductId): string {
  const c = document.createElement("canvas");
  c.width = 88;
  c.height = 44;
  const g = c.getContext("2d")!;
  g.fillStyle = "#070b14";
  g.fillRect(0, 0, 88, 44);
  g.globalCompositeOperation = "lighter";
  const P = PRODUCTS[id];
  const cols: string[] =
    P.kind === "rgb" ? ["#ff2d3a", "#ffffff"] : (P.colors ?? ["#ffd996"]);
  if (P.kind === "spot") {
    const gr = g.createRadialGradient(44, 20, 0, 44, 20, 30);
    gr.addColorStop(0, "rgba(255,214,150,.8)");
    gr.addColorStop(1, "rgba(255,214,150,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 88, 44);
  } else if (P.kind === "wreath") {
    for (let a = 0; a < 14; a++) {
      const an = (a / 14) * 6.283;
      g.fillStyle = "#ffd996";
      g.beginPath();
      g.arc(44 + Math.cos(an) * 13, 22 + Math.sin(an) * 13, 2, 0, 7);
      g.fill();
    }
  } else {
    const spacing = P.spacingFt ?? 1;
    const n = spacing < 0.5 ? 14 : 7;
    for (let i = 0; i < n; i++) {
      const x = 8 + i * (72 / (n - 1));
      const y = P.kind === "icicle" ? 14 : 22;
      const col = cols[i % cols.length]!;
      const gr = g.createRadialGradient(x, y, 0, x, y, 9);
      gr.addColorStop(0, col);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(x - 9, y - 9, 18, 18);
      if (P.kind === "icicle") {
        for (let d = 6; d < 6 + ((i % 3) + 1) * 7; d += 6) {
          g.fillStyle = col;
          g.beginPath();
          g.arc(x, y + d, 1.3, 0, 7);
          g.fill();
        }
      }
    }
  }
  return c.toDataURL();
}
