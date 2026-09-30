// Product catalog and rates. Products are data, not code: the editor, the
// renderer and the estimate all read from here. In the multi-tenant product
// each contractor will supply their own catalog; for now this is the single
// example catalog from the prototype.

/**
 * How a product is drawn and counted.
 * - strand: bulbs along a drawn line (C9, mini lights)
 * - icicle: drops hanging from a drawn line
 * - rgb:    permanent track; bulb colors come from a pattern
 * - wreath: a placed item with a physical size in feet
 * - spot:   a placed uplight fixture
 */
export type ProductKind = "strand" | "icicle" | "rgb" | "wreath" | "spot";

export type Unit = "ft" | "each";

export interface Product {
  name: string;
  kind: ProductKind;
  /** Price per unit, in dollars. */
  rate: number;
  unit: Unit;
  /** Bulb spacing along the strand, in feet (line products only). */
  spacingFt?: number;
  /** Bulb radius, in feet (line products only). */
  bulbRadiusFt?: number;
  /** Bulb colors, cycled along the strand. Unused for rgb (see patterns). */
  colors?: string[];
  /** Adds a faint light wash on the wall below every other bulb. */
  wash?: boolean;
  /** Scatters bulbs around the line, for bushes and trees. */
  jitter?: boolean;
  /** Physical diameter in feet (wreath). */
  sizeFt?: number;
}

const PRODUCT_DEFS = {
  c9warm: {
    name: "C9 bulbs, warm white",
    kind: "strand",
    rate: 4.5,
    unit: "ft",
    spacingFt: 1,
    bulbRadiusFt: 0.14,
    colors: ["#ffcf7a"],
    wash: true,
  },
  c9multi: {
    name: "C9 bulbs, multicolor",
    kind: "strand",
    rate: 4.5,
    unit: "ft",
    spacingFt: 1,
    bulbRadiusFt: 0.14,
    colors: ["#ff4b4b", "#43d86b", "#3f8bff", "#ffc24b", "#ff7be0"],
    wash: true,
  },
  mini: {
    name: "Mini lights, bushes & trees",
    kind: "strand",
    rate: 3,
    unit: "ft",
    spacingFt: 0.3,
    bulbRadiusFt: 0.05,
    colors: ["#ffd996"],
    jitter: true,
  },
  icicle: {
    name: "Icicle lights, cool white",
    kind: "icicle",
    rate: 5.5,
    unit: "ft",
    spacingFt: 0.5,
    bulbRadiusFt: 0.05,
    colors: ["#e8f1ff"],
  },
  rgb: {
    name: "Permanent RGB track",
    kind: "rgb",
    rate: 32,
    unit: "ft",
    spacingFt: 0.5,
    bulbRadiusFt: 0.08,
    wash: true,
  },
  wreath: {
    name: "Lit wreath, 36 in",
    kind: "wreath",
    rate: 95,
    unit: "each",
    sizeFt: 3,
  },
  spot: {
    name: "Uplight",
    kind: "spot",
    rate: 70,
    unit: "each",
  },
} satisfies Record<string, Product>;

export type ProductId = keyof typeof PRODUCT_DEFS;

export const PRODUCTS: Record<ProductId, Product> = PRODUCT_DEFS;

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

export function isProductId(v: unknown): v is ProductId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PRODUCTS, v);
}

export function getProduct(id: ProductId): Product {
  return PRODUCTS[id];
}

export function isLineProduct(p: Product): boolean {
  return p.kind === "strand" || p.kind === "icicle" || p.kind === "rgb";
}

/**
 * Patterns for the permanent RGB track. A pattern either cycles a fixed list
 * of colors bulb by bulb, or is an animated rainbow chase.
 */
export interface Pattern {
  label: string;
  colors?: string[];
  animated?: "rainbow";
}

const PATTERN_DEFS = {
  warm: { label: "Warm white", colors: ["#ffc878"] },
  candy: { label: "Candy cane", colors: ["#ff2d3a", "#ff2d3a", "#ffffff", "#ffffff"] },
  redgreen: { label: "Red & green", colors: ["#22e05a", "#ff2d3a"] },
  rainbow: { label: "Rainbow chase", animated: "rainbow" },
} satisfies Record<string, Pattern>;

export type PatternId = keyof typeof PATTERN_DEFS;

export const PATTERNS: Record<PatternId, Pattern> = PATTERN_DEFS;

export const PATTERN_IDS = Object.keys(PATTERNS) as PatternId[];

export function isPatternId(v: unknown): v is PatternId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PATTERNS, v);
}

export const DEFAULT_PATTERN: PatternId = "candy";

/** Editor and estimate settings that are not per-product. */
export const SETTINGS = {
  /** Photos are stored at natural size, capped at this width in pixels. */
  maxPhotoWidthPx: 1600,
  /** With no scale set, assume the photo spans this many feet across. */
  assumedPhotoWidthFt: 50,
  /** Suggested reference length for the scale tool (a two-car garage door). */
  defaultScaleRefFt: 16,
  currency: "USD",
  locale: "en-US",
} as const;
