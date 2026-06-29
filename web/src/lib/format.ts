import dayjs from "dayjs";
import "dayjs/locale/de.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("de");

/** The WG lives in one place — render times in Berlin regardless of device tz. */
const WG_TZ = "Europe/Berlin";

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
  return dayjs(iso).tz(WG_TZ).format("dd, DD.MM. HH:mm");
}

/** "Mo, 14.05." style short date (no time) */
export function formatDate(iso: string): string {
  return dayjs(iso).tz(WG_TZ).format("dd, DD.MM.");
}

/** Full weekday, e.g. "Mittwoch" */
export function formatWeekday(iso: string): string {
  return dayjs(iso).tz(WG_TZ).format("dddd");
}

/** "25. Juni" */
export function formatDayMonth(iso: string): string {
  return dayjs(iso).tz(WG_TZ).format("D. MMMM");
}

/** "19:00" */
export function formatTime(iso: string): string {
  return dayjs(iso).tz(WG_TZ).format("HH:mm");
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
