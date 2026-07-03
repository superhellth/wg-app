import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { sendPushToMember } from "../lib/push.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

type MeetingRow = typeof schema.meetings.$inferSelect;

/**
 * Next occurrence of a meeting at/after `now`:
 *  - unresolved poll (startsAt null) → null (skip)
 *  - fixed → startsAt, only if still in the future
 *  - recurring → first startsAt + k·recurEveryDays that is >= now
 */
export function nextOccurrence(m: MeetingRow, now: Date): Date | null {
  if (!m.startsAt) return null;
  const start = m.startsAt.getTime();
  if (!m.recurEveryDays) {
    return start >= now.getTime() ? m.startsAt : null;
  }
  const stepMs = m.recurEveryDays * DAY_MS;
  if (start >= now.getTime()) return m.startsAt;
  const k = Math.ceil((now.getTime() - start) / stepMs);
  return new Date(start + k * stepMs);
}

/** Reminder recipients: active members who haven't RSVP'd "no". */
async function reminderRecipients(meetingId: string): Promise<string[]> {
  const active = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(isNull(schema.members.archivedAt));
  const rsvps = await db
    .select()
    .from(schema.meetingRsvps)
    .where(eq(schema.meetingRsvps.meetingId, meetingId));
  const declined = new Set(
    rsvps.filter((r) => r.value === "no").map((r) => r.memberId),
  );
  return active.map((m) => m.id).filter((id) => !declined.has(id));
}

/**
 * Meeting reminders — run every ~5 min. Push 1h before each occurrence, once per
 * occurrence (dedup via meetings.lastReminderAt = the occurrence reminded).
 */
export async function runMeetingReminders(now = new Date()): Promise<void> {
  const meetings = await db.select().from(schema.meetings);
  for (const m of meetings) {
    const occurrence = nextOccurrence(m, now);
    if (!occurrence) continue;

    const lead = occurrence.getTime() - now.getTime();
    if (lead < 0 || lead > HOUR_MS) continue; // not within the hour before
    if (m.lastReminderAt && m.lastReminderAt.getTime() >= occurrence.getTime()) {
      continue; // already reminded for this occurrence
    }

    // Record first so a slow push can't double-fire on the next tick.
    await db
      .update(schema.meetings)
      .set({ lastReminderAt: occurrence })
      .where(eq(schema.meetings.id, m.id));

    const recipients = await reminderRecipients(m.id);
    const payload = {
      title: "Erinnerung: Treffen",
      body: m.title,
      url: "/meetings",
    };
    await Promise.all(recipients.map((id) => sendPushToMember(id, payload)));
  }
}

/**
 * Chore grace warning — run hourly. Push whoever's up once, inside the grace
 * window: after the missed Sunday deadline but before the grace cutoff
 * (dueAt < now < dueAt + graceDays, AND graceNotifiedAt IS NULL). Lands Monday.
 * Past the cutoff it's pointless (they're already skipped), so we don't fire.
 */
export async function runChoreGraceWarning(now = new Date()): Promise<void> {
  const [wgRow] = await db
    .select({ graceDays: schema.wg.graceDays })
    .from(schema.wg)
    .limit(1);
  const graceDays = wgRow?.graceDays ?? 2;
  const windowStart = new Date(now.getTime() - graceDays * DAY_MS); // dueAt > this

  const turns = await db
    .select()
    .from(schema.choreTurns)
    .where(
      and(
        isNull(schema.choreTurns.completedAt),
        isNull(schema.choreTurns.skippedAt),
        isNull(schema.choreTurns.graceNotifiedAt),
        lt(schema.choreTurns.dueAt, now), // overdue
        gt(schema.choreTurns.dueAt, windowStart), // grace not yet expired
      ),
    );
  if (turns.length === 0) return;

  const chores = await db.select().from(schema.chores);
  const nameById = new Map(chores.map((c) => [c.id, c.name]));

  for (const t of turns) {
    await db
      .update(schema.choreTurns)
      .set({ graceNotifiedAt: now })
      .where(eq(schema.choreTurns.id, t.id));
    await sendPushToMember(t.executorId ?? t.assigneeId, {
      title: "Überfällig",
      body: `${nameById.get(t.choreId) ?? "Aufgabe"} bald erledigen, sonst wird übersprungen`,
      url: "/chores",
    });
  }
}
