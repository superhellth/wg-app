import cron from "node-cron";
import { runMeetingCleanup } from "./services/cleanup.js";
import { runChoreOverdue, runMeetingReminders } from "./services/reminders.js";

/**
 * Cron worker — time-based push only (chore overdue, meeting reminders).
 * Event-driven push (turn started, new meeting/poll) fires inline from the API,
 * not here. See docs/impl-api.md §cron for the dispatch rules.
 */

console.log("[worker] cron worker started");

function runJob(name: string, fn: () => Promise<void>): void {
  fn().catch((err) => console.error(`[worker] ${name} failed`, err));
}

// Meeting reminders: every 5 min, push 1h before each occurrence
// (dedup via meetings.last_reminder_at).
cron.schedule("*/5 * * * *", () => runJob("meeting-reminders", runMeetingReminders));

// Chore overdue: hourly, push once 1 day after due
// (now >= dueAt + 24h AND overdue_notified_at IS NULL).
cron.schedule("0 * * * *", () => runJob("chore-overdue", runChoreOverdue));

// Stale meeting cleanup: hourly, hard-delete fixed meetings >12h past.
cron.schedule("0 * * * *", () => runJob("meeting-cleanup", runMeetingCleanup));

// Catch up immediately on startup (dedup markers prevent double-sends).
runJob("meeting-reminders", runMeetingReminders);
runJob("chore-overdue", runChoreOverdue);
runJob("meeting-cleanup", runMeetingCleanup);

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
