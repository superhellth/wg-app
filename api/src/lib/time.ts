import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

/** Single German WG → fixed timezone (configurable later). */
const TZ = "Europe/Berlin";

const DAY_MS = 24 * 3_600_000;
const WEEK_MS = 7 * DAY_MS;

/** Upcoming Sunday 23:59:59.999 in Europe/Berlin (ISO week, Mon–Sun). */
export function endOfThisWeek(from: Date): Date {
  return dayjs(from).tz(TZ).endOf("isoWeek").toDate();
}

/** First turn's deadline when a task is created: this coming Sunday (Berlin). */
export function firstChoreDue(from: Date): Date {
  return endOfThisWeek(from);
}

/**
 * How many rotation steps a completion advances the open turn, given the turn's
 * deadline and the WG grace window. 1 = normal (skip nobody). >1 skips
 * `steps − 1` people — the late clean is deemed to cover them (one extra skip
 * per full week past the grace cutoff). See docs/chore-rota-redesign.md.
 *
 * Grace cutoffs sit at `prevDue + graceDays + k·7d` (k = 0,1,2…). `steps` = 1 +
 * (number of those cutoffs already passed at completion time).
 */
export function advanceSteps(prevDue: Date, graceDays: number, now: Date): number {
  const cutoff0 = prevDue.getTime() + graceDays * DAY_MS;
  const past = now.getTime() - cutoff0;
  if (past <= 0) return 1; // early / on-time / within grace
  return 2 + Math.floor(past / WEEK_MS);
}

/** Next deadline: always a Sunday, marched off the previous one (not `now`). */
export function nextChoreDue(prevDue: Date, steps: number): Date {
  return new Date(prevDue.getTime() + steps * WEEK_MS);
}

/**
 * Earliest a turn may be marked done: `dueAt − interval` (one rotation week).
 * = the start of the turn's own week, so a future turn can't be burned early;
 * overdue turns (dueAt in the past) are always past this and stay checkable.
 */
export function choreDoneOpensAt(dueAt: Date): Date {
  return new Date(dueAt.getTime() - WEEK_MS);
}
