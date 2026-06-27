import type { ChoreFrequency } from "@wg/shared";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

/** Single German WG → fixed timezone (configurable later). */
const TZ = "Europe/Berlin";

/** Upcoming Sunday 23:59:59.999 in Europe/Berlin (ISO week, Mon–Sun). */
export function endOfThisWeek(from: Date): Date {
  return dayjs(from).tz(TZ).endOf("isoWeek").toDate();
}

/** Interval length in days for a chore frequency. */
export function intervalDaysFor(
  frequency: ChoreFrequency,
  intervalDays?: number | null,
): number {
  if (frequency === "weekly") return 7;
  if (frequency === "biweekly") return 14;
  return intervalDays ?? 7; // custom (validated present at the schema level)
}

/** Chore turn due date: end of this week + interval length. */
export function choreDueDate(from: Date, intervalDays: number): Date {
  return dayjs(endOfThisWeek(from)).add(intervalDays, "day").toDate();
}
