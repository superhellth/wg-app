import { lt } from "drizzle-orm";
import { db, schema } from "../db/client.js";

const HOUR_MS = 3_600_000;

/**
 * Stale meeting cleanup — run hourly. Hard-delete meetings whose start is
 * more than 12h in the past.
 */
export async function runMeetingCleanup(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - 12 * HOUR_MS);
  const deleted = await db
    .delete(schema.meetings)
    .where(lt(schema.meetings.startsAt, cutoff))
    .returning({ id: schema.meetings.id });
  if (deleted.length > 0) {
    console.log(`[worker] meeting-cleanup removed ${deleted.length}`);
  }
}
