import {
  BILLING_CYCLES,
  CHORE_FREQUENCIES,
  DISPLAY_FUNCTIONS,
  MEETING_MODES,
  type PushKeys,
  RSVP_VALUES,
  SPLIT_TYPES,
} from "@wg/shared";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ── enums (values sourced from @wg/shared — single source of truth) ──
export const splitTypeEnum = pgEnum("split_type", SPLIT_TYPES);
export const choreFrequencyEnum = pgEnum("chore_frequency", CHORE_FREQUENCIES);
export const meetingModeEnum = pgEnum("meeting_mode", MEETING_MODES);
export const rsvpEnum = pgEnum("rsvp", RSVP_VALUES);
export const billingCycleEnum = pgEnum("billing_cycle", BILLING_CYCLES);
export const displayFunctionEnum = pgEnum("display_function", DISPLAY_FUNCTIONS);

// ── core ────────────────────────────────────────────────────────────
/** Single WG (one row). The shared WG join secret lives in env, not here. */
export const wg = pgTable("wg", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  // if set and in the future, member is auto-skipped in all chore rotations
  awayUntil: timestamp("away_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** A device's Web Push subscription + the member it currently claims. */
export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  currentMemberId: uuid("current_member_id").references(() => members.id),
  // unique: registration upserts on endpoint (the browser's stable sub URL)
  pushEndpoint: text("push_endpoint").notNull().unique(),
  pushKeys: jsonb("push_keys").$type<PushKeys>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Expiring invite tokens. Reusable until expiry (NOT single-use). */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  createdByMemberId: uuid("created_by_member_id").references(() => members.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── money ───────────────────────────────────────────────────────────
// Expenses + settlements are HARD-deleted; all changes are logged to `activity`
// (no separate audit table). Balances are computed on read.
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  payerId: uuid("payer_id").references(() => members.id).notNull(),
  amount: integer("amount").notNull(), // cents
  description: text("description").notNull(),
  category: text("category"),
  splitType: splitTypeEnum("split_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expenseShares = pgTable("expense_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expense_id").references(() => expenses.id).notNull(),
  memberId: uuid("member_id").references(() => members.id).notNull(),
  // owed cents for this member (resolved from splitType at write time)
  amount: integer("amount").notNull(),
  // raw per-member input that produced `amount`, kept ONLY so an edit form can
  // reconstruct the original split faithfully (exact=cents, shares=count,
  // percent=points; null for equal). NOT authoritative — `amount` drives balances.
  inputValue: doublePrecision("input_value"),
});

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromMemberId: uuid("from_member_id").references(() => members.id).notNull(),
  toMemberId: uuid("to_member_id").references(() => members.id).notNull(),
  amount: integer("amount").notNull(), // cents, partial allowed
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── financial overview (standalone, NOT linked to ledger) ────────────
// Always split equally among active members; per-person share computed on read.
export const fixedCosts = pgTable("fixed_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(), // cents
  cycle: billingCycleEnum("cycle").notNull(),
  contractHolderId: uuid("contract_holder_id").references(() => members.id).notNull(),
});

// ── shopping ────────────────────────────────────────────────────────
export const shoppingItems = pgTable("shopping_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  addedByMemberId: uuid("added_by_member_id").references(() => members.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  boughtAt: timestamp("bought_at", { withTimezone: true }),
});

// ── chores ──────────────────────────────────────────────────────────
export const chores = pgTable("chores", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  frequency: choreFrequencyEnum("frequency").notNull(),
  intervalDays: integer("interval_days"),
  rotation: jsonb("rotation").$type<string[]>().notNull(), // ordered member ids
});

export const choreTurns = pgTable("chore_turns", {
  id: uuid("id").primaryKey().defaultRandom(),
  choreId: uuid("chore_id").references(() => chores.id).notNull(),
  assigneeId: uuid("assignee_id").references(() => members.id).notNull(),
  // authoritative rotation position (a swap changes assignee, not this)
  rotationIndex: integer("rotation_index").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  skippedAt: timestamp("skipped_at", { withTimezone: true }),
  // set by cron when the overdue push is sent (dedup; fires once at due + 24h)
  overdueNotifiedAt: timestamp("overdue_notified_at", { withTimezone: true }),
});

// ── meetings ────────────────────────────────────────────────────────
export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  mode: meetingModeEnum("mode").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  recurEveryDays: integer("recur_every_days"),
  // occurrence time of the last reminder sent (dedup; recurring-safe)
  lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
  createdByMemberId: uuid("created_by_member_id").references(() => members.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const meetingOptions = pgTable("meeting_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").references(() => meetings.id, { onDelete: "cascade" }).notNull(),
  optionTime: timestamp("option_time", { withTimezone: true }).notNull(),
});

export const meetingVotes = pgTable("meeting_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  optionId: uuid("option_id").references(() => meetingOptions.id, { onDelete: "cascade" }).notNull(),
  memberId: uuid("member_id").references(() => members.id).notNull(),
});

export const meetingRsvps = pgTable("meeting_rsvps", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").references(() => meetings.id, { onDelete: "cascade" }).notNull(),
  memberId: uuid("member_id").references(() => members.id).notNull(),
  value: rsvpEnum("value").notNull(),
});

// ── physical Pi display (one row) ───────────────────────────────────
// 4 buttons (blue/yellow/red/green → GPIO 12/16/20/21) map to display
// functions; defaultFunction shows when idle. Driven by the LCD daemon.
export const displayConfig = pgTable("display_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  defaultFunction: displayFunctionEnum("default_function").notNull().default("saldo"),
  idleTimeoutSeconds: integer("idle_timeout_seconds").notNull().default(30),
  buttonBlue: displayFunctionEnum("button_blue"),
  buttonYellow: displayFunctionEnum("button_yellow"),
  buttonRed: displayFunctionEnum("button_red"),
  buttonGreen: displayFunctionEnum("button_green"),
  // Time control: blank the screen outside [onTime, offTime) Europe/Berlin.
  scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
  onTime: text("on_time").notNull().default("07:00"),
  offTime: text("off_time").notNull().default("23:00"),
});

// ── activity feed (append-only; also the audit trail) ───────────────
export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id"), // null = system/cron action
  kind: text("kind").notNull(), // see ACTIVITY_KINDS in @wg/shared
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
