# Fixkosten → Ausgaben auto-generation — design

> Status: approved by user, pending spec review.
> Supersedes the "standalone, not linked to the ledger" decision in
> `docs/target-functionality.md` §3 and the "out of scope" note in §8.

## Goal

Each fixed cost (`Fixkosten`) automatically creates a real expense
(`Ausgaben`) on its billing cycle, instead of being a purely
informational board. No manual step required in the common case.

## Data model changes

### `api/src/db/schema.ts` — `fixedCosts` table

Add two columns:

- `next_due_at timestamptz not null` — when the next expense generation
  is due. Replaces the implicit "no date" state; user sets an initial
  due date when creating the cost, cron advances it after each firing.
- `active boolean not null default true` — pause toggle. Paused costs
  are skipped by generation but still shown (muted) in the Fixkosten
  list.

Migration: existing rows get `next_due_at` backfilled to
`now() + 1 cycle` (per `cycle`) so they don't all fire immediately on
deploy, and `active = true`.

### `shared/src/fixedCost.ts`

- `createFixedCostSchema` / `fixedCostSchema`: add `nextDueAt` (ISO
  datetime string) and `active` (boolean, default `true` client-side).
- `fixedCostViewSchema`: unchanged shape (`perPersonShare` stays
  computed-on-read), just inherits the two new fields.

### Activity log

Reuse the existing `expense.created` kind (no new kind needed) —
`logActivity` already supports `memberId: null` for "system/cron
action" per `shared/src/activity.ts`. Auto-generated expenses log with
`memberId: null` and the usual `{ snapshot }` payload, so they're
visible in the feed and distinguishable from member-authored entries
by the null actor.

## Generation logic

New `api/src/services/fixedCostGeneration.ts`, following the existing
`services/cleanup.ts` / `services/reminders.ts` pattern (plain async
function, called by both the cron job and an immediate run-on-startup
catch-up).

```
runFixedCostGeneration():
  for each fixedCosts row where active = true AND next_due_at <= now():
    activeMembers = members where archivedAt is null
    shares = activeMembers.map(m => ({ memberId: m.id, value: 1 }))  // equal split
    expense = {
      payerId: row.contractHolderId,
      amount: row.amount,
      description: row.name,
      category: "Fixkosten",
      splitType: "equal",
      shares,
    }
    db.transaction:
      insert expense (+ resolved shares, via existing resolveShares path)
      logActivity({ memberId: null, kind: "expense.created", data: { snapshot: expense } })
      advance row.next_due_at by one cycle from its *old* value
      // catch-up: if still <= now() (worker was down), keep advancing
      // the due date until it's in the future, but only ever insert
      // ONE expense for the whole gap
      while row.next_due_at <= now(): row.next_due_at += 1 cycle
      update fixedCosts row (next_due_at)
```

Cycle arithmetic (`monthly`/`quarterly`/`yearly`) uses the same
Europe/Berlin calendar-boundary convention already used for chores
(`docs/impl-api.md`), not raw millisecond math, so month-length
irregularities behave as a human expects (e.g. due-on-31st in a
30-day month lands on the last day, not overflowing into the next
month).

Edge case — no active members: skip the row this tick (can't split
among zero people), leave `next_due_at` unchanged so it's picked up
next tick once someone's active again. Logged via `console.error` in
the worker, no activity entry (nothing was created).

## Cron wiring (`api/src/worker.ts`)

```js
cron.schedule("0 3 * * *", () => runJob("fixedcost-generation", runFixedCostGeneration));
runJob("fixedcost-generation", runFixedCostGeneration); // startup catch-up
```

Daily at 03:00 is enough resolution — cycles are month+ granularity,
no need for the 5min/hourly cadence used by meeting/chore jobs.

## API surface

No new routes. `api/src/routes/fixedCosts.ts` create/update handlers
accept the two new fields via the extended shared schema (`safeParse`
already wired). No route change needed for generation itself — it's
worker-only, like meeting reminders/cleanup.

## Web UI (`web/src/pages/Fixkosten.tsx`)

- `FixedCostDialog`: add a date field for `nextDueAt` ("Nächste
  Fälligkeit", required) and an `active` switch ("Aktiv" /
  "Pausiert"), defaulting to `true` for new costs.
- Card: show next due date under the cycle/contract-holder line, e.g.
  `Fällig: 03.09.2026`. Paused costs render at reduced opacity with a
  "Pausiert" `Chip`.
- Remove the `Alert` banner ("Reine Übersicht — nicht mit dem
  Ausgaben-Tab verbunden") since it's now false.
- No changes needed in `web/src/pages/Ausgaben.tsx` — generated
  expenses are just regular expenses (category `"Fixkosten"`), they
  show up, are editable/deletable, and feed balances exactly like any
  other expense.

## Docs to update

- `docs/target-functionality.md` §3: rewrite to describe the
  auto-generation link instead of "standalone/not connected"; §8:
  remove the "Recurring / auto-repeating expenses... out of scope"
  and "Linking Financial Overview to the ledger" bullets.
- `docs/impl-api.md`: document the new cron job and generation
  service next to the existing cron section.
- `docs/impl-web.md`: document the new Fixkosten dialog fields.

## Out of scope (this change)

- Per-fixed-cost custom participant sets (equal-among-active-members
  only, matching current display behavior).
- Editing an in-flight `nextDueAt` behavior when `cycle` itself is
  edited (mid-cycle edits just keep the stored `next_due_at` as-is;
  no special reconciliation logic).
- Notifications/push for generated expenses (money stays push-free
  per `docs/target-functionality.md` §7).
