import type { DisplayFunction, DisplayRender } from "@wg/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { db, schema } from "../db/client.js";
import { computeBalances } from "./balances.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Single German WG → render LCD times in Berlin regardless of host tz. */
const TZ = "Europe/Berlin";

/** Hard cap to 16 columns (the LCD width). */
const COLS = 16;
const clip = (s: string): string => (s.length > COLS ? s.slice(0, COLS) : s);

/** cents → "12,50" (optionally signed with a real minus glyph). */
function euro(cents: number, signed = false): string {
  const s = (Math.abs(cents) / 100).toFixed(2).replace(".", ",");
  if (!signed) return s;
  if (cents > 0) return `+${s}`;
  if (cents < 0) return `-${s}`;
  return s;
}

function ddmm(date: Date): string {
  return dayjs(date).tz(TZ).format("DD.MM. HH:mm");
}

async function memberNames(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: schema.members.id, name: schema.members.displayName })
    .from(schema.members);
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Pack "name + value" into 16 cols, value right-aligned when it fits. */
function pad(left: string, right: string): string {
  const room = COLS - right.length - 1;
  const l = left.length > room ? left.slice(0, Math.max(0, room)) : left;
  const gap = COLS - l.length - right.length;
  return gap >= 1 ? `${l}${" ".repeat(gap)}${right}` : clip(`${l} ${right}`);
}

async function renderShopping(): Promise<DisplayRender> {
  const items = await db
    .select({ name: schema.shoppingItems.name })
    .from(schema.shoppingItems)
    .where(isNull(schema.shoppingItems.boughtAt))
    .orderBy(desc(schema.shoppingItems.createdAt));
  // Full names — the LCD daemon scrolls anything wider than the panel.
  const lines = items.map((i) => i.name);
  return {
    function: "shopping",
    title: `Einkauf (${items.length})`,
    lines: lines.length ? lines : ["- leer -"],
  };
}

async function renderChores(): Promise<DisplayRender> {
  const names = await memberNames();
  const chores = await db.select().from(schema.chores);
  const turns = await db
    .select()
    .from(schema.choreTurns)
    .where(
      and(
        isNull(schema.choreTurns.completedAt),
        isNull(schema.choreTurns.skippedAt),
      ),
    );
  const byChore = new Map(turns.map((t) => [t.choreId, t]));
  const lines = chores.map((c) => {
    const t = byChore.get(c.id);
    const who = t ? names.get(t.executorId ?? t.assigneeId) ?? "?" : "-";
    return pad(c.name, who);
  });
  return {
    function: "chores",
    title: "Putzplan",
    lines: lines.length ? lines : ["- keine -"],
  };
}

async function renderSaldo(): Promise<DisplayRender> {
  const names = await memberNames();
  const balances = await computeBalances();
  const lines = Object.entries(balances)
    .sort((a, b) => b[1] - a[1])
    .map(([id, cents]) => pad(names.get(id) ?? "?", euro(cents, true)));
  return {
    function: "saldo",
    title: "Saldo (EUR)",
    lines: lines.length ? lines : ["- keine -"],
  };
}

async function renderAppointment(): Promise<DisplayRender> {
  const now = new Date();
  const meetings = await db.select().from(schema.meetings);
  const next = meetings
    .filter((m) => m.startsAt && m.startsAt.getTime() > now.getTime())
    .sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime())[0];
  return {
    function: "appointment",
    title: "Naechster Termin",
    lines: next
      ? [next.title, ddmm(next.startsAt!)]
      : ["- keiner -"],
  };
}

/** Very compact German predicates for the feed (no money detail). */
function activityShort(kind: string): string {
  if (kind.startsWith("expense.")) return "Ausgabe";
  if (kind.startsWith("settlement.")) return "Zahlung";
  if (kind.startsWith("shopping.")) return "Einkauf";
  if (kind.startsWith("chore.")) return "Aufgabe";
  if (kind.startsWith("meeting.") || kind.startsWith("poll.")) return "Termin";
  if (kind.startsWith("member.")) return "Mitglied";
  if (kind.startsWith("fixedcost.")) return "Fixkosten";
  return kind;
}

async function renderActivity(): Promise<DisplayRender> {
  const names = await memberNames();
  const rows = await db
    .select({
      memberId: schema.activity.memberId,
      kind: schema.activity.kind,
    })
    .from(schema.activity)
    .orderBy(desc(schema.activity.createdAt), desc(schema.activity.id))
    .limit(8);
  const lines = rows.map((r) => {
    const who = r.memberId ? names.get(r.memberId) ?? "?" : "Sys";
    return pad(who, activityShort(r.kind));
  });
  return {
    function: "activity",
    title: "Aktivitaet",
    lines: lines.length ? lines : ["- nichts -"],
  };
}

/** Build the 16x2-ready payload for a display function. */
export function renderDisplay(fn: DisplayFunction): Promise<DisplayRender> {
  switch (fn) {
    case "shopping":
      return renderShopping();
    case "chores":
      return renderChores();
    case "saldo":
      return renderSaldo();
    case "appointment":
      return renderAppointment();
    case "activity":
      return renderActivity();
  }
}
