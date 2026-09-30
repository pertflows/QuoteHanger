"use client";

// The lighting editor: a port of prototype.html to React. The canvas is drawn
// with the plain 2D API by `Renderer`; the design itself lives in a mutable
// ref (like the prototype's `state`), and `changed()` bumps a counter so the
// control rail re-renders. All coordinates are image pixels.

import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_PATTERN,
  isLineProduct,
  PATTERN_IDS,
  PATTERNS,
  PRODUCT_IDS,
  PRODUCTS,
  SETTINGS,
  type PatternId,
  type ProductId,
} from "@/config/catalog";
import type { DesignDoc, Item, ScaleSource, Strand } from "@/lib/design";
import { estimate } from "@/lib/estimate";
import { money, rateLabel } from "@/lib/format";
import { polyLen, segDist, type Pt } from "@/lib/geometry";
import { findSel, itemCenterY, itemRadius, Renderer, type Mode, type Selection } from "./render";
import { paintSample, SAMPLE_H, SAMPLE_PX_PER_FT, SAMPLE_W, sampleDesign } from "./sampleHouse";
import { swatch } from "./swatch";

type Step = 1 | 2 | 3;

interface Model {
  W: number;
  H: number;
  night: number;
  ppf: number;
  scaleSource: ScaleSource;
  sample: boolean;
  strands: Strand[];
  items: Item[];
  mode: Mode;
  product: ProductId;
  pattern: PatternId;
  draft: Strand | null;
  sel: Selection;
  cursor: { x: number; y: number } | null;
  compare: boolean;
  scalePts: Pt[] | null;
  step: Step;
}

type Drag =
  | { kind: "vertex"; o: Strand; i: number; moved: boolean }
  | { kind: "item"; o: Item; dx: number; dy: number; moved: boolean }
  | { kind: "strand"; o: Strand; sx: number; sy: number; orig: Pt[]; moved: boolean };

type Hit = { kind: "vertex"; o: Strand; i: number } | { kind: "item"; o: Item } | { kind: "strand"; o: Strand };

interface LeadCard {
  img: string;
  when: string;
  name: string;
  email: string;
  phone: string;
  feet: number;
  accents: number;
  total: number;
  names: string[];
}

const HISTORY_LIMIT = 80;

// ---------- small presentational helpers ----------

const B = ({ children }: { children: ReactNode }) => <b className="font-semibold text-bulb">{children}</b>;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bulb";
const btnBase = `font-body text-[13px] font-semibold leading-none rounded-lg border px-3 py-[9px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-[.45] ${focusRing}`;
const btn = `${btnBase} bg-raise text-fg border-line hover:border-muted`;
const btnPrimary = `${btnBase} bg-bulb text-bulb-ink border-bulb hover:brightness-[1.07]`;
const labelCls = "font-mono text-[11px] font-semibold leading-none uppercase tracking-[.08em] text-muted";
const inputCls = `w-full rounded-lg border border-line bg-night px-2.5 py-[9px] text-[15px] leading-[1.3] text-fg ${focusRing}`;
const fine = "text-xs text-muted";

function productName(id: ProductId) {
  return PRODUCTS[id].name;
}

export default function Editor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleFtRef = useRef<HTMLInputElement>(null);
  const model = useRef<Model>({
    W: SAMPLE_W,
    H: SAMPLE_H,
    night: 0.85,
    ppf: SAMPLE_PX_PER_FT,
    scaleSource: "user",
    sample: true,
    strands: [],
    items: [],
    mode: "draw",
    product: "c9warm",
    pattern: DEFAULT_PATTERN,
    draft: null,
    sel: null,
    cursor: null,
    compare: false,
    scalePts: null,
    step: 2,
  });
  const bg = useRef<CanvasImageSource | null>(null);
  const renderer = useRef<Renderer | null>(null);
  const history = useRef<string[]>([]);
  const uid = useRef(1);
  const dirty = useRef(true);
  const drag = useRef<Drag | null>(null);
  const reduceMotion = useRef(false);

  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [hint, setHint] = useState<ReactNode>("Loading…");
  const [swatches, setSwatches] = useState<Partial<Record<ProductId, string>>>({});
  const [scaleMsg, setScaleMsg] = useState("");
  const [scaleFt, setScaleFt] = useState(String(SETTINGS.defaultScaleRefFt));
  const [dragOver, setDragOver] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadCard | null>(null);

  const m = model.current;

  // ---------- core ----------

  const changed = useCallback(() => {
    dirty.current = true;
    bump();
  }, []);

  const snapshot = () => JSON.stringify({ s: m.strands, i: m.items });
  const pushHistory = () => {
    history.current.push(snapshot());
    if (history.current.length > HISTORY_LIMIT) history.current.shift();
  };
  const undo = () => {
    if (m.draft && m.draft.pts.length) {
      m.draft.pts.pop();
      if (!m.draft.pts.length) m.draft = null;
      changed();
      return;
    }
    const h = history.current.pop();
    if (!h) return;
    const o = JSON.parse(h) as { s: Strand[]; i: Item[] };
    m.strands = o.s;
    m.items = o.i;
    m.sel = null;
    changed();
  };

  const design = (): DesignDoc => ({
    photo: { w: m.W, h: m.H },
    pxPerFt: m.ppf,
    scaleSource: m.scaleSource,
    strands: m.strands,
    items: m.items,
  });

  const modeHint = () => {
    if (m.mode === "select")
      return setHint("Click a strand to select it. Drag the white dots to reshape it, or drag the strand to move it.");
    const P = PRODUCTS[m.product];
    if (!isLineProduct(P))
      return setHint(
        <>
          Click where the <B>{P.name}</B> should go.
        </>,
      );
    setHint(
      <>
        Click along the house to hang <B>{P.name}</B>. Double-click or press <B>Finish</B> to end the strand.
      </>,
    );
  };

  const finishDraft = () => {
    const d = m.draft;
    m.draft = null;
    if (d && d.pts.length >= 2) {
      pushHistory();
      m.strands.push(d);
      setHint(
        <>
          Strand added: <B>{Math.round(polyLen(d.pts) / m.ppf)} ft</B>. Click to start another, or switch to{" "}
          <B>Select &amp; move</B> to adjust it.
        </>,
      );
    }
    changed();
  };

  const deleteSel = () => {
    const sel = m.sel;
    if (!sel) return;
    pushHistory();
    if (sel.type === "strand") m.strands = m.strands.filter((s) => s.id !== sel.id);
    else m.items = m.items.filter((s) => s.id !== sel.id);
    m.sel = null;
    changed();
  };

  // ---------- scale ----------

  const startScale = () => {
    finishDraft();
    m.mode = "scale";
    m.scalePts = null;
    setScaleMsg("Click two points on the photo, for example both edges of the garage door.");
    setHint(
      <>
        Scale: click <B>two points</B> along something you know the length of.
      </>,
    );
    changed();
  };
  const endScale = () => {
    m.mode = "draw";
    m.scalePts = null;
  };
  const applyScale = () => {
    const ft = parseFloat(scaleFt);
    const p = m.scalePts;
    if (!(ft > 0) || !p || p.length < 2) {
      setScaleMsg("Enter a length in feet, then try again.");
      return;
    }
    const px = Math.hypot(p[1]![0] - p[0]![0], p[1]![1] - p[0]![1]);
    if (!(px > 0)) {
      setScaleMsg("Those two points are the same. Click two different points.");
      m.scalePts = null;
      changed();
      return;
    }
    m.ppf = px / ft;
    m.scaleSource = "user";
    renderer.current?.clearCache();
    endScale();
    setStep(2);
    setHint(
      <>
        Scale set: <B>{m.ppf.toFixed(1)} px per ft</B>. Now pick a light and hang it.
      </>,
    );
  };

  // ---------- steps ----------

  const setStep = (n: Step) => {
    m.step = n;
    if (n === 3) {
      finishDraft();
      m.sel = null;
      setHint("Here is your design. Send it to get a visit and a final price.");
    } else if (n === 2) modeHint();
    else if (m.mode !== "scale") setHint("Upload a photo of your house, or keep the sample.");
    changed();
  };

  // ---------- photo ----------

  const resizeCanvas = (w: number, h: number) => {
    const cv = canvasRef.current!;
    m.W = cv.width = w;
    m.H = cv.height = h;
  };

  const resetDesign = () => {
    // A new photo starts a new design; undo does not reach across photos.
    history.current = [];
    m.strands = [];
    m.items = [];
    m.draft = null;
    m.sel = null;
    renderer.current?.clearCache();
  };

  const loadImage = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) {
      setHint("That file is not an image. Choose a JPG or PNG photo.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, SETTINGS.maxPhotoWidthPx / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      bg.current = c;
      resizeCanvas(c.width, c.height);
      resetDesign();
      m.ppf = m.W / SETTINGS.assumedPhotoWidthFt;
      m.scaleSource = "estimated";
      m.sample = false;
      setLead(null);
      setStep(1);
      startScale();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setHint("That photo could not be opened. Try a different JPG or PNG.");
    };
    img.src = url;
  };

  const loadSample = () => {
    bg.current = paintSample();
    resizeCanvas(SAMPLE_W, SAMPLE_H);
    resetDesign();
    const d = sampleDesign();
    m.strands = d.strands;
    m.items = d.items;
    uid.current = d.nextId;
    m.ppf = SAMPLE_PX_PER_FT;
    m.scaleSource = "user";
    m.sample = true;
    setLead(null);
    endScale();
    setStep(2);
  };

  // ---------- pointer input ----------

  const pos = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * m.W) / r.width, y: ((e.clientY - r.top) * m.H) / r.height, k: m.W / r.width };
  };

  const hitTest = (p: { x: number; y: number; k: number }): Hit | null => {
    const tol = 14 * p.k;
    const cur = findSel(m);
    if (cur && "pts" in cur) {
      const i = cur.pts.findIndex((q) => Math.hypot(q[0] - p.x, q[1] - p.y) < tol);
      if (i >= 0) return { kind: "vertex", o: cur, i };
    }
    for (let j = m.items.length - 1; j >= 0; j--) {
      const it = m.items[j]!;
      if (Math.hypot(it.x - p.x, itemCenterY(it) - p.y) < Math.max(tol, itemRadius(it, m.ppf)))
        return { kind: "item", o: it };
    }
    for (let j = m.strands.length - 1; j >= 0; j--) {
      const s = m.strands[j]!;
      for (let i = 1; i < s.pts.length; i++)
        if (segDist(p.x, p.y, s.pts[i - 1]!, s.pts[i]!) < tol) return { kind: "strand", o: s };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pos(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (m.mode === "scale") {
      if (!m.scalePts || m.scalePts.length === 2) m.scalePts = [[p.x, p.y]];
      else {
        m.scalePts.push([p.x, p.y]);
        setScaleMsg("How long is that line in real life?");
      }
      changed();
      return;
    }
    if (m.mode === "draw") {
      const P = PRODUCTS[m.product];
      if (!isLineProduct(P)) {
        pushHistory();
        const it: Item = { id: uid.current++, product: m.product, x: p.x, y: p.y };
        m.items.push(it);
        m.sel = { type: "item", id: it.id };
        setHint(
          <>
            {P.name} placed. Click again to add another, or drag it with <B>Select &amp; move</B>.
          </>,
        );
        changed();
        return;
      }
      if (!m.draft)
        m.draft = {
          id: uid.current++,
          product: m.product,
          pts: [],
          pattern: P.kind === "rgb" ? m.pattern : null,
        };
      const last = m.draft.pts[m.draft.pts.length - 1];
      if (!last || Math.hypot(last[0] - p.x, last[1] - p.y) > 3 * p.k) m.draft.pts.push([p.x, p.y]);
      changed();
      return;
    }
    // select mode
    const h = hitTest(p);
    if (!h) {
      m.sel = null;
      changed();
      return;
    }
    pushHistory();
    if (h.kind === "vertex") drag.current = { kind: "vertex", o: h.o, i: h.i, moved: false };
    else if (h.kind === "item") {
      m.sel = { type: "item", id: h.o.id };
      drag.current = { kind: "item", o: h.o, dx: p.x - h.o.x, dy: p.y - h.o.y, moved: false };
    } else {
      m.sel = { type: "strand", id: h.o.id };
      drag.current = {
        kind: "strand",
        o: h.o,
        sx: p.x,
        sy: p.y,
        orig: h.o.pts.map((q) => [q[0], q[1]] as Pt),
        moved: false,
      };
    }
    changed();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pos(e);
    m.cursor = { x: p.x, y: p.y };
    const d = drag.current;
    if (d) {
      d.moved = true;
      if (d.kind === "vertex") d.o.pts[d.i] = [p.x, p.y];
      else if (d.kind === "item") {
        d.o.x = p.x - d.dx;
        d.o.y = p.y - d.dy;
      } else {
        const dx = p.x - d.sx;
        const dy = p.y - d.sy;
        d.o.pts = d.orig.map((q) => [q[0] + dx, q[1] + dy]);
      }
      changed();
      return;
    }
    if ((m.mode === "draw" && m.draft) || (m.mode === "scale" && m.scalePts?.length === 1)) dirty.current = true;
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (d && !d.moved) history.current.pop();
    if (d) changed(); // refresh footage in the rail after a drag
    drag.current = null;
  };

  // ---------- keyboard ----------

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t?.matches?.("input,select,textarea")) return;
    if (e.key === "Enter" && m.draft) {
      finishDraft();
      e.preventDefault();
    } else if (e.key === "Escape") {
      m.draft = null;
      m.sel = null;
      if (m.mode === "scale") endScale();
      changed();
    } else if ((e.key === "Delete" || e.key === "Backspace") && m.sel) {
      deleteSel();
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      undo();
      e.preventDefault();
    }
  };

  // ---------- boot + render loop ----------

  useEffect(() => {
    reduceMotion.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.current = new Renderer();
    loadSample();
    setSwatches(Object.fromEntries(PRODUCT_IDS.map((id) => [id, swatch(id)])));

    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    const tick = (t: number) => {
      const mm = model.current;
      const anim =
        !reduceMotion.current &&
        [...mm.strands, ...(mm.draft ? [mm.draft] : [])].some(
          (s) => PRODUCTS[s.product].kind === "rgb" && s.pattern && PATTERNS[s.pattern].animated,
        );
      if ((dirty.current || anim) && bg.current && renderer.current) {
        const k = mm.W / cv.getBoundingClientRect().width || 1;
        renderer.current.render(ctx, { ...mm, pxPerFt: mm.ppf, bg: bg.current, reduceMotion: reduceMotion.current }, t, k);
        dirty.current = false;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    const onResize = () => (dirty.current = true);
    addEventListener("keydown", onKey);
    addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("keydown", onKey);
      removeEventListener("resize", onResize);
    };
    // Boot once; everything else reads the model ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scaleReady = m.mode === "scale" && m.scalePts?.length === 2;
  useEffect(() => {
    if (scaleReady) scaleFtRef.current?.focus();
  }, [scaleReady]);

  // ---------- lead ----------

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const cv = canvasRef.current!;
    // Snapshot the picture without selection handles or other overlay.
    renderer.current!.render(
      cv.getContext("2d")!,
      { ...m, pxPerFt: m.ppf, bg: bg.current!, reduceMotion: reduceMotion.current },
      performance.now(),
      1,
      { overlay: false },
    );
    const img = cv.toDataURL("image/jpeg", 0.82);
    dirty.current = true;

    const doc = design();
    const est = estimate(doc);
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact, design: doc, estimate: est }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setLead({
        img,
        when: new Date().toLocaleString(SETTINGS.locale, { weekday: "short", hour: "numeric", minute: "2-digit" }),
        ...contact,
        feet: est.feet,
        accents: est.accents,
        total: est.total,
        names: est.rows.map((r) => productName(r.product).split(",")[0]!),
      });
      setHint("Design sent. In the real product this lands in the contractor’s lead inbox with the photo and footage attached.");
    } catch (err) {
      setSendError(`Could not send your design (${(err as Error).message}). Please try again.`);
    } finally {
      setSending(false);
    }
  };

  // ---------- derived UI state ----------

  const sel = findSel(m);
  const est = estimate(design());
  const rgbSelected = sel && PRODUCTS[sel.product].kind === "rgb" ? (sel as Strand) : null;
  const showPattern = (m.mode === "draw" && PRODUCTS[m.product].kind === "rgb") || !!rgbSelected;
  const patternValue = rgbSelected?.pattern ?? m.pattern;
  const scaleGuess = m.scaleSource === "estimated";

  const pickProduct = (id: ProductId) => {
    finishDraft();
    if (m.mode === "scale") endScale();
    m.product = id;
    m.mode = "draw";
    m.sel = null;
    modeHint();
    changed();
  };

  const onPattern = (v: PatternId) => {
    m.pattern = v;
    if (m.draft && PRODUCTS[m.draft.product].kind === "rgb") m.draft.pattern = v;
    if (rgbSelected) {
      pushHistory();
      rgbSelected.pattern = v;
    }
    changed();
  };

  const compareOn = (e: React.SyntheticEvent) => {
    e.preventDefault();
    m.compare = true;
    dirty.current = true;
  };
  const compareOff = () => {
    m.compare = false;
    dirty.current = true;
  };

  const tabs: { n: Step; label: string }[] = [
    { n: 1, label: "Your photo" },
    { n: 2, label: "Hang lights" },
    { n: 3, label: "Get my quote" },
  ];

  return (
    <div className="mx-auto flex min-h-full max-w-[1500px] flex-col gap-3 px-4 pb-5 pt-[14px]">
      <header className="flex flex-wrap items-baseline gap-3.5">
        <div className="flex items-center gap-2.5 font-display text-[22px] font-bold leading-none tracking-[-.01em]">
          <span
            className="h-3 w-3 rounded-full bg-bulb shadow-[0_0_12px_3px_rgba(255,198,110,.55)]"
            aria-hidden="true"
          />
          QuoteHanger
        </div>
        <span className="rounded border border-warn/45 px-2 py-[5px] font-mono text-[11px] font-semibold uppercase leading-none tracking-[.08em] text-warn">
          Preview
        </span>
        <span className="text-sm text-muted">Hang lights on your own house, see it at night, get a price.</span>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 min-[901px]:grid-cols-[minmax(0,1fr)_340px]">
        {/* stage */}
        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="min-w-0 flex-[1_1_260px] rounded-lg border border-line bg-raise px-3 py-2 text-sm text-fg"
              aria-live="polite"
            >
              {hint}
            </div>
            <label
              className="flex items-center gap-2 rounded-lg border border-line bg-raise px-2.5 py-1.5 text-[13px] text-muted"
              htmlFor="night"
            >
              Day
              <input
                id="night"
                type="range"
                min={0}
                max={100}
                defaultValue={85}
                className="w-[110px] accent-bulb"
                onInput={(e) => {
                  m.night = Number(e.currentTarget.value) / 100;
                  dirty.current = true;
                }}
              />
              Night
            </label>
            <button
              type="button"
              className={btn}
              title="Hold to see the house without lights"
              onPointerDown={compareOn}
              onPointerUp={compareOff}
              onPointerLeave={compareOff}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") compareOn(e);
              }}
              onKeyUp={compareOff}
            >
              Hold: before
            </button>
            <button
              type="button"
              className={btn}
              title="Undo (Ctrl+Z)"
              onClick={undo}
              disabled={!history.current.length && !(m.draft && m.draft.pts.length)}
            >
              Undo
            </button>
          </div>
          <div className="relative flex items-center justify-center overflow-hidden rounded-[10px] border border-line bg-stage">
            <canvas
              ref={canvasRef}
              width={SAMPLE_W}
              height={SAMPLE_H}
              aria-label="House photo with placed lights"
              className={`block h-auto max-h-[72vh] w-auto max-w-full touch-none ${
                m.mode === "select" ? "cursor-default" : "cursor-crosshair"
              }`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => {
                m.cursor = null;
                dirty.current = true;
              }}
              onDoubleClick={() => {
                if (m.mode === "draw") finishDraft();
              }}
            />
            {m.sample && (
              <span className="pointer-events-none absolute left-2.5 top-2.5 rounded bg-night/75 px-2 py-1.5 font-mono text-[11px] font-semibold uppercase leading-none tracking-[.08em] text-muted">
                Sample house
              </span>
            )}
          </div>
        </section>

        {/* rail */}
        <aside className="flex min-w-0 flex-col rounded-xl border border-line bg-panel">
          <div className="grid grid-cols-3 border-b border-line" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.n}
                type="button"
                role="tab"
                aria-selected={m.step === t.n}
                onClick={() => setStep(t.n)}
                className={`flex flex-col items-center gap-[5px] border-b-2 bg-transparent px-1.5 pb-3 pt-3.5 text-[13px] font-semibold leading-none ${focusRing} ${
                  m.step === t.n ? "border-bulb text-fg" : "border-transparent text-muted"
                }`}
              >
                <span className="font-mono text-[11px] font-semibold tracking-[.06em]">STEP {t.n}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* STEP 1 */}
          {m.step === 1 && (
            <div className="flex flex-col gap-3.5 p-4">
              <h2 className="font-display text-[19px] font-bold leading-[1.2] [text-wrap:balance]">
                Start with a photo of your house
              </h2>
              <label
                htmlFor="file"
                className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed px-3 py-5 text-center hover:border-bulb hover:text-fg ${
                  dragOver ? "border-bulb text-fg" : "border-line text-muted"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  loadImage(e.dataTransfer.files[0]);
                }}
              >
                <strong className="font-semibold text-fg">Choose a photo</strong>
                <span>or drop one here. JPG or PNG.</span>
              </label>
              <input
                id="file"
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  loadImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button type="button" className={btn} onClick={loadSample}>
                Use the sample house instead
              </button>
              <div className={labelCls}>For the best result</div>
              <ul className="m-0 grid list-disc gap-1 pl-[18px] text-sm text-muted">
                <li>Stand across the street and face the house straight on.</li>
                <li>Take it in daylight. We turn it to night for you.</li>
                <li>Get the whole roofline in the frame.</li>
              </ul>
              <div className={labelCls}>Measurements</div>
              <p className="text-sm text-muted">
                Feet and price come from the scale. Draw a line along something you know, like a garage door
                (usually {SETTINGS.defaultScaleRefFt} ft wide).
              </p>
              <button type="button" className={btn} onClick={startScale}>
                Set the scale
              </button>
              {m.mode === "scale" && (
                <div className="grid gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm">
                  <span>{scaleMsg}</span>
                  {scaleReady && (
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={scaleFtRef}
                        type="number"
                        min={1}
                        step={0.5}
                        value={scaleFt}
                        onChange={(e) => setScaleFt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") applyScale();
                        }}
                        aria-label="Length in feet"
                        className={`${inputCls} flex-1`}
                      />
                      <button type="button" className={btnPrimary} onClick={applyScale}>
                        Use as feet
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {m.step === 2 && (
            <div className="flex flex-col gap-3.5 p-4">
              <h2 className="font-display text-[19px] font-bold leading-[1.2] [text-wrap:balance]">
                Pick a light, then click along the house
              </h2>
              <div className="grid grid-cols-2 gap-1.5">
                {(["select", "draw"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={m.mode === mode}
                    className={`${btn} ${m.mode === mode ? "!border-bulb !text-bulb" : ""}`}
                    onClick={() => {
                      if (mode === "select") finishDraft();
                      if (m.mode === "scale") endScale();
                      m.mode = mode;
                      if (mode === "draw") m.sel = null;
                      modeHint();
                      changed();
                    }}
                  >
                    {mode === "select" ? "Select & move" : "Hang lights"}
                  </button>
                ))}
              </div>
              <div className="grid gap-1.5">
                {PRODUCT_IDS.map((id) => {
                  const P = PRODUCTS[id];
                  const on = m.mode === "draw" && m.product === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickProduct(id)}
                      className={`${btn} grid grid-cols-[44px_1fr_auto] items-center gap-2.5 px-2.5 py-2 text-left font-medium ${
                        on ? "!border-bulb bg-[color-mix(in_srgb,#ffc66e_12%,#1b2539)]" : ""
                      }`}
                    >
                      <span
                        className="block h-[22px] rounded bg-[#070b14] bg-cover bg-center"
                        style={swatches[id] ? { backgroundImage: `url(${swatches[id]})` } : undefined}
                      />
                      <span>{P.name}</span>
                      <span className="font-mono text-xs font-medium text-muted">{rateLabel(P.rate, P.unit)}</span>
                    </button>
                  );
                })}
              </div>
              {showPattern && (
                <div className="grid gap-1.5">
                  <label className={labelCls} htmlFor="pattern">
                    Permanent track pattern
                  </label>
                  <select
                    id="pattern"
                    className={inputCls}
                    value={patternValue ?? DEFAULT_PATTERN}
                    onChange={(e) => onPattern(e.target.value as PatternId)}
                  >
                    {PATTERN_IDS.map((id) => (
                      <option key={id} value={id}>
                        {PATTERNS[id].label}
                        {PATTERNS[id].animated ? " (animated)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {m.draft && m.draft.pts.length >= 1 && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnPrimary} onClick={finishDraft}>
                    Finish this strand
                  </button>
                </div>
              )}
              {sel && (
                <div className="flex items-center justify-between gap-2.5 rounded-lg border border-line bg-raise px-3 py-2.5 text-sm">
                  <span>
                    <b>{PRODUCTS[sel.product].name}</b>
                    {"pts" in sel && (
                      <>
                        <br />
                        <span className={fine}>{Math.round(polyLen(sel.pts) / m.ppf)} ft</span>
                      </>
                    )}
                  </span>
                  <button type="button" className={btn} onClick={deleteSel}>
                    Delete
                  </button>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <span>
                  <span className={labelCls}>Estimate</span>
                  <br />
                  <span className={fine}>
                    {est.feet} ft of lights{scaleGuess ? " (scale not set)" : ""}
                  </span>
                </span>
                <span className="font-mono text-[22px] font-semibold leading-none text-bulb">{money(est.total)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btn}
                  onClick={() => {
                    pushHistory();
                    m.strands = [];
                    m.items = [];
                    m.draft = null;
                    m.sel = null;
                    setHint(
                      <>
                        Cleared. <B>Undo</B> brings it back.
                      </>,
                    );
                    changed();
                  }}
                >
                  Clear all
                </button>
                <button type="button" className={`${btnPrimary} flex-1`} onClick={() => setStep(3)}>
                  See my quote
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {m.step === 3 && (
            <div className="flex flex-col gap-3.5 p-4">
              <h2 className="font-display text-[19px] font-bold leading-[1.2] [text-wrap:balance]">
                Your design and estimate
              </h2>
              <table className="w-full border-collapse text-[13px] [&_td]:border-b [&_td]:border-line [&_td]:py-[7px] [&_td]:text-left [&_td]:align-top [&_th]:border-b [&_th]:border-line [&_th]:py-[7px] [&_th]:text-left">
                <thead>
                  <tr>
                    <th className={labelCls}>Item</th>
                    <th className={`${labelCls} !text-right`}>Qty</th>
                    <th className={`${labelCls} !text-right`}>Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {est.rows.map((r) => (
                    <tr key={r.key}>
                      <td>{r.name}</td>
                      <td className="whitespace-nowrap font-mono tabular-nums !text-right">
                        {r.qty}
                        {r.unit === "ft" ? " ft" : ""}
                      </td>
                      <td className="whitespace-nowrap font-mono tabular-nums !text-right">{money(r.cost)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <b>Total estimate</b>
                    </td>
                    <td />
                    <td className="whitespace-nowrap font-mono tabular-nums !text-right">
                      <b>{money(est.total)}</b>
                    </td>
                  </tr>
                  {scaleGuess && (
                    <tr>
                      <td colSpan={3} className="text-xs !text-warn">
                        Scale is a guess. Set it in step 1 for real footage.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className={fine}>
                Example rates. Each contractor sets their own prices. This is a concept picture and a ballpark, not a
                final quote.
              </p>
              {!lead ? (
                <form className="flex flex-col gap-3.5" onSubmit={submitLead}>
                  <div className={labelCls}>Send it to the installer</div>
                  <div className="grid gap-1.5">
                    <label htmlFor="lname">Name</label>
                    <input
                      id="lname"
                      type="text"
                      required
                      maxLength={200}
                      autoComplete="name"
                      className={inputCls}
                      value={contact.name}
                      onChange={(e) => setContact({ ...contact, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="lemail">Email</label>
                    <input
                      id="lemail"
                      type="email"
                      required
                      maxLength={320}
                      autoComplete="email"
                      className={inputCls}
                      value={contact.email}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="lphone">Phone</label>
                    <input
                      id="lphone"
                      type="tel"
                      maxLength={50}
                      autoComplete="tel"
                      className={inputCls}
                      value={contact.phone}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    />
                  </div>
                  <button type="submit" className={btnPrimary} disabled={sending}>
                    {sending ? "Sending…" : "Send my design"}
                  </button>
                  {sendError && (
                    <p className="text-sm text-warn" role="alert">
                      {sendError}
                    </p>
                  )}
                </form>
              ) : (
                <div>
                  <div className={`${labelCls} mb-2`}>What the contractor receives</div>
                  <div className="overflow-hidden rounded-[10px] border border-line bg-raise">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data: URL snapshot */}
                    <img src={lead.img} alt="The homeowner's lighting design" className="block w-full" />
                    <div className="grid gap-1.5 p-3 text-sm">
                      <span className="font-mono text-xs font-medium leading-none text-ok">New lead · {lead.when}</span>
                      <b>{lead.name}</b>
                      <span className={fine}>
                        {lead.email}
                        {lead.phone ? ` · ${lead.phone}` : ""}
                      </span>
                      <span>
                        {lead.feet} ft of lights, {lead.accents} accent pieces · <b>{money(lead.total)}</b> est.
                      </span>
                      <span className={fine}>{lead.names.join(" · ")}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid gap-1 border-l-[3px] border-bulb py-0.5 pl-3">
                <strong className="font-semibold">Next: photo-real finish</strong>
                <span className={fine}>
                  The layout you drew goes to the AI image model together with the photo, so the render puts lights
                  exactly where you hung them.
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
