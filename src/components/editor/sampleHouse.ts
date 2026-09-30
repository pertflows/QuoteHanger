// The built-in sample house, painted on a canvas, and the example design that
// goes with it. Used until the homeowner uploads their own photo.

import type { Item, Strand } from "@/lib/design";

export const SAMPLE_W = 1600;
export const SAMPLE_H = 1000;
/** Known scale of the painted sample: 16 ft garage door ≈ 248 px. */
export const SAMPLE_PX_PER_FT = 15.5;

export function paintSample(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SAMPLE_W;
  c.height = SAMPLE_H;
  const g = c.getContext("2d")!;
  let gr = g.createLinearGradient(0, 0, 0, 760);
  gr.addColorStop(0, "#8fb6de");
  gr.addColorStop(1, "#dce7f1");
  g.fillStyle = gr;
  g.fillRect(0, 0, 1600, 760);
  // distant tree line
  g.fillStyle = "#50704f";
  g.beginPath();
  g.moveTo(0, 760);
  for (let x = 0; x <= 1600; x += 40) g.lineTo(x, 690 + Math.sin(x * 0.021) * 18 + Math.sin(x * 0.057) * 10);
  g.lineTo(1600, 760);
  g.fill();
  // lawn
  gr = g.createLinearGradient(0, 760, 0, 1000);
  gr.addColorStop(0, "#5f8d40");
  gr.addColorStop(1, "#46702f");
  g.fillStyle = gr;
  g.fillRect(0, 760, 1600, 240);
  // driveway + walk
  const poly = (pts: [number, number][]) => {
    g.beginPath();
    g.moveTo(pts[0]![0], pts[0]![1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  };
  g.fillStyle = "#a3a39d";
  poly([[1210, 760], [1400, 760], [1580, 1000], [1120, 1000]]);
  g.fill();
  g.fillStyle = "#c9c1b0";
  poly([[822, 760], [878, 760], [930, 1000], [770, 1000]]);
  g.fill();
  // walls
  const wall = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = "#ebe6da";
    g.fillRect(x, y, w, h);
    g.strokeStyle = "#d7d0c1";
    g.lineWidth = 1.5;
    for (let yy = y + 12; yy < y + h; yy += 13) {
      g.beginPath();
      g.moveTo(x, yy);
      g.lineTo(x + w, yy);
      g.stroke();
    }
  };
  wall(540, 420, 620, 340);
  wall(1160, 560, 290, 200);
  g.fillStyle = "#9a9489";
  g.fillRect(540, 742, 620, 18);
  g.fillRect(1160, 742, 290, 18);
  // chimney
  g.fillStyle = "#8a4b3a";
  g.fillRect(1000, 222, 46, 80);
  g.fillStyle = "#6e3a2d";
  g.fillRect(994, 216, 58, 10);
  // roofs
  const roof = (pts: [number, number][]) => {
    g.fillStyle = "#454b57";
    poly(pts);
    g.closePath();
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = "rgba(0,0,0,.18)";
    g.lineWidth = 1;
    for (let y = 0; y < 1000; y += 11) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(1600, y);
      g.stroke();
    }
    g.restore();
  };
  roof([[510, 420], [620, 280], [1080, 280], [1190, 420]]);
  roof([[1150, 560], [1210, 480], [1420, 480], [1480, 560]]);
  g.fillStyle = "#f3f2ee";
  g.fillRect(510, 418, 680, 9);
  g.fillRect(1150, 558, 330, 8);
  // windows
  const win = (x: number, y: number, w: number, h: number, lit: boolean) => {
    g.fillStyle = "#2f4a3a";
    g.fillRect(x - 20, y, 16, h);
    g.fillRect(x + w + 4, y, 16, h);
    g.fillStyle = "#fbfbf8";
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    g.fillStyle = lit ? "#e9c98a" : "#62788f";
    g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,.22)";
    poly([[x, y], [x + w * 0.55, y], [x, y + h * 0.5]]);
    g.fill();
    g.strokeStyle = "#fbfbf8";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x + w / 2, y);
    g.lineTo(x + w / 2, y + h);
    g.moveTo(x, y + h / 2);
    g.lineTo(x + w, y + h / 2);
    g.stroke();
  };
  [585, 690, 950, 1055].forEach((x, i) => {
    win(x, 455, 60, 80, i === 2);
    win(x, 598, 60, 94, i === 1);
  });
  win(820, 455, 60, 80, false);
  // garage door
  g.fillStyle = "#f2f0ea";
  g.fillRect(1210, 612, 190, 148);
  g.strokeStyle = "#d6d2c8";
  g.lineWidth = 2;
  for (let y = 648; y < 760; y += 37) {
    g.beginPath();
    g.moveTo(1210, y);
    g.lineTo(1400, y);
    g.stroke();
  }
  g.fillStyle = "#6f8499";
  for (let x = 1222; x < 1400; x += 46) g.fillRect(x, 620, 36, 20);
  // portico
  g.fillStyle = "#6b1f22";
  g.fillRect(820, 618, 60, 124);
  g.fillStyle = "#d8b36a";
  g.fillRect(868, 680, 5, 5);
  g.fillStyle = "#fbfbf8";
  g.fillRect(778, 592, 16, 150);
  g.fillRect(906, 592, 16, 150);
  g.fillRect(768, 582, 164, 12);
  g.fillStyle = "#454b57";
  poly([[762, 584], [850, 538], [938, 584]]);
  g.fill();
  g.fillStyle = "#b9b4aa";
  g.fillRect(796, 742, 108, 8);
  g.fillRect(786, 750, 128, 10);
  // bushes
  const bush = (cx: number) => {
    for (const [dx, dy, r] of [[-38, 6, 30], [-12, -6, 34], [18, -4, 32], [40, 8, 26], [0, 10, 34]] as const) {
      g.fillStyle = "#2d5a35";
      g.beginPath();
      g.arc(cx + dx, 722 + dy, r, 0, 7);
      g.fill();
    }
    g.fillStyle = "rgba(120,170,90,.25)";
    g.beginPath();
    g.arc(cx - 8, 708, 18, 0, 7);
    g.fill();
  };
  [600, 700, 1000, 1100].forEach(bush);
  // evergreen
  g.fillStyle = "#5a3b26";
  g.fillRect(320, 730, 20, 40);
  for (let k = 0; k < 5; k++) {
    const top = 300 + k * 78;
    const base = top + 150;
    const hw = ((base - 300) / 440) * 115 + 6;
    g.fillStyle = k % 2 ? "#24492f" : "#2c5838";
    poly([[330, top], [330 - hw, Math.min(base, 745)], [330 + hw, Math.min(base, 745)]]);
    g.fill();
  }
  return c;
}

/** The example design for the sample house. Ids start at 1. */
export function sampleDesign(): { strands: Strand[]; items: Item[]; nextId: number } {
  let id = 1;
  const S = (product: Strand["product"], pts: Strand["pts"], pattern: Strand["pattern"] = null): Strand => ({
    id: id++,
    product,
    pts,
    pattern,
  });
  const strands: Strand[] = [
    S("c9warm", [[510, 421], [620, 281], [1080, 281], [1190, 421]]),
    S("c9warm", [[512, 425], [1188, 425]]),
    S("c9warm", [[1150, 559], [1210, 481], [1420, 481], [1480, 559]]),
    S("icicle", [[1152, 565], [1478, 565]]),
    S("rgb", [[764, 586], [850, 540], [936, 586]], "candy"),
    S("mini", [[330, 318], [312, 382], [372, 455], [270, 535], [412, 612], [230, 700], [438, 728]]),
    S("mini", [[555, 712], [600, 690], [650, 702], [700, 688], [748, 712]]),
    S("mini", [[955, 712], [1000, 690], [1050, 702], [1100, 688], [1148, 712]]),
  ];
  const items: Item[] = [
    { id: id++, product: "wreath", x: 850, y: 660 },
    { id: id++, product: "spot", x: 560, y: 756 },
    { id: id++, product: "spot", x: 1138, y: 756 },
  ];
  return { strands, items, nextId: id };
}
