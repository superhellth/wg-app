import cron from "node-cron";

/**
 * Cron worker — time-based push only (chore overdue, meeting reminders).
 * Event-driven push (turn started, new meeting/poll) fires inline from the API,
 * not here. See docs/impl-api.md §cron for the dispatch rules.
 */

console.log("[worker] cron worker started");

// Meeting reminders: every 5 min, push 1h before each occurrence
// (dedup via meetings.last_reminder_at).
cron.schedule("*/5 * * * *", () => {
  // TODO: implement meeting reminder dispatch
});

// Chore overdue: hourly, push once 1 day after due
// (now >= dueAt + 24h AND overdue_notified_at IS NULL).
cron.schedule("0 * * * *", () => {
  // TODO: implement overdue dispatch
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
