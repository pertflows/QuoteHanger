import { SETTINGS } from "@/config/catalog";

/** Whole-dollar money, e.g. "$1,234". */
export function money(v: number): string {
  return "$" + Math.round(v).toLocaleString(SETTINGS.locale);
}

/** Catalog rate as shown on a product button, e.g. "$4.50/ft" or "$95/ea". */
export function rateLabel(rate: number, unit: "ft" | "each"): string {
  return unit === "each" ? `$${rate}/ea` : `$${rate.toFixed(2)}/ft`;
}
