import dayjs from "dayjs";
import "dayjs/locale/de.js";
import relativeTime from "dayjs/plugin/relativeTime.js";

dayjs.extend(relativeTime);
dayjs.locale("de");

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

/** cents → "12,50 €" */
export function formatCents(cents: number): string {
  return eur.format(cents / 100);
}

/** cents → "+12,50 €" / "−12,50 €" (with sign, real minus glyph) */
export function formatSignedCents(cents: number): string {
  const s = formatCents(Math.abs(cents));
  if (cents > 0) return `+${s}`;
  if (cents < 0) return `−${s}`;
  return s;
}

/** "vor 3 Stunden" */
export function fromNow(iso: string): string {
  return dayjs(iso).fromNow();
}

/** "Mo, 14:30" style short date-time */
export function formatDateTime(iso: string): string {
  return dayjs(iso).format("dd, DD.MM. HH:mm");
}

/** cents → "14,50" plain editable string (no currency symbol), for form prefill. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** "14,50" string → cents (int). Accepts comma or dot. Returns null if invalid. */
export function parseEurToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}
