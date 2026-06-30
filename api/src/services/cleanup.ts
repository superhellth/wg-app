import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "../db/client.js";

const HOUR_MS = 3_600_000;

/**
 * Stale meeting cleanup — run hourly. Hard-delete fixed one-off meetings whose
 * start is more than 12h in the past. Options, votes and rsvps cascade at the
 * DB level. Recurring meetings (no end) and polls — including resolved ones —
 * are left untouched (mode != "fixed").
 */
export async function runMeetingCleanup(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - 12 * HOUR_MS);
  const deleted = await db
    .delete(schema.meetings)
    .where(
      and(
        eq(schema.meetings.mode, "fixed"), // one-off only — skip recurring + poll
        lt(schema.meetings.startsAt, cutoff),
      ),
    )
    .returning({ id: schema.meetings.id });
  if (deleted.length > 0) {
    console.log(`[worker] meeting-cleanup removed ${deleted.length}`);
  }
}
