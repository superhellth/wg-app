# Fixkosten → Ausgaben Auto-Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each fixed cost auto-creates a real expense on its billing cycle (monthly/quarterly/yearly), instead of being a purely informational board.

**Architecture:** Add `nextDueAt`/`active` columns to `fixedCosts`. A new daily cron job (`api/src/worker.ts`) scans due, active fixed costs and inserts a matching expense (payer = contract holder, equal split among active members) + activity-log entry, in one transaction, then advances `nextDueAt` by one cycle. Web UI gets a due-date picker and pause toggle on the fixed-cost dialog, and the "not linked" banner is removed.

**Tech Stack:** Fastify + Drizzle + Postgres (api), Zod (shared), Vite + React + MUI + `@mui/x-date-pickers` + dayjs (web). No test runner is configured in this repo — verification gates are `pnpm typecheck` / `pnpm build`, plus one manual DB smoke-test task at the end.

**Spec:** `docs/superpowers/specs/2026-08-16-fixkosten-auto-expense-design.md`

## Global Constraints

- All money is integer cents (`shared/src/common.ts` — `cents`), EUR only.
- All human-readable and cycle-boundary date logic must use the `Europe/Berlin` timezone via `dayjs` + its `utc`/`timezone` plugins (see `api/src/lib/time.ts`, `web/src/lib/format.ts`) — never raw `Date` arithmetic or host/device tz.
- Every mutating DB write that should appear in the audit trail is wrapped in one `db.transaction` together with its `logActivity` call (`api/src/lib/activity.ts`) — no change without its log entry.
- Reuse the existing `expense.created` activity kind for auto-generated expenses, with `memberId: null` (the established "system/cron action" convention — see `shared/src/activity.ts` and `api/src/services/reminders.ts`'s cron pattern). Do not add a new activity kind.
- Split type for generated expenses is always `"equal"`, participants = all currently-active (non-archived) members, payer = the fixed cost's `contractHolderId`.
- No live Postgres is confirmed reachable in this dev environment yet (per `CLAUDE.md`) — DB-dependent verification steps are best-effort; if the DB isn't reachable, note it and continue, don't block the plan on it. There is no existing migration yet, so the schema change ships in the (first) generated migration — no backfill logic is needed.

---

### Task 1: Shared schema — `nextDueAt` + `active` on fixed costs

**Files:**
- Modify: `shared/src/fixedCost.ts`

**Interfaces:**
- Produces: `createFixedCostSchema` now requires `nextDueAt: string` (ISO datetime) and `active: boolean` (with a `.default(true)`); `fixedCostSchema` (and therefore `fixedCostViewSchema`) includes both fields. `CreateFixedCost`, `UpdateFixedCost`, `FixedCost`, `FixedCostView` types gain `nextDueAt: string` and `active: boolean`.

- [ ] **Step 1: Edit the schema**

Replace the file's schema definitions:

```typescript
import { z } from "zod";
import { cents, isoDate, uuid } from "./common.js";
import { billingCycle, type BillingCycle } from "./enums.js";

export { billingCycle };
export type { BillingCycle };

/**
 * Financial Overview board entry. Each cost auto-generates a matching
 * expense in the ledger on its billing cycle (see `nextDueAt`/`active`) —
 * payer = contractHolderId, split equally among active members.
 */
export const createFixedCostSchema = z.object({
  name: z.string().min(1).max(120),
  amount: cents.positive(),
  cycle: billingCycle,
  contractHolderId: uuid,
  /** When the next expense generation is due. */
  nextDueAt: isoDate,
  /** Paused costs are skipped by generation but still shown in the list. */
  active: z.boolean().default(true),
});
export type CreateFixedCost = z.infer<typeof createFixedCostSchema>;

export const updateFixedCostSchema = createFixedCostSchema;
export type UpdateFixedCost = z.infer<typeof updateFixedCostSchema>;

export const fixedCostSchema = createFixedCostSchema.extend({
  id: uuid,
});
export type FixedCost = z.infer<typeof fixedCostSchema>;

/** Read shape: the stored cost plus the computed equal share (cents). */
export const fixedCostViewSchema = fixedCostSchema.extend({
  perPersonShare: cents,
});
export type FixedCostView = z.infer<typeof fixedCostViewSchema>;
```

- [ ] **Step 2: Typecheck the shared package**

Run: `pnpm --filter @wg/shared typecheck`
Expected: PASS (this only changes types/schema, no consumers touched yet — `api`/`web` typecheck failures are expected and fixed in later tasks).

- [ ] **Step 3: Commit**

```bash
git add shared/src/fixedCost.ts
git commit -m "feat(shared): add nextDueAt/active to fixed cost schema"
```

---

### Task 2: DB schema — `next_due_at` / `active` columns

**Files:**
- Modify: `api/src/db/schema.ts:107-113` (the `fixedCosts` table)

**Interfaces:**
- Consumes: nothing new.
- Produces: `schema.fixedCosts.nextDueAt` (Drizzle column, JS property `nextDueAt`, `timestamp` with tz, not null), `schema.fixedCosts.active` (`boolean`, not null, default `true`).

- [ ] **Step 1: Edit the table definition**

```typescript
// ── financial overview ────────────────────────────────────────────
// Auto-generates a matching expense on the ledger each billing cycle
// (see api/src/services/fixedCostGeneration.ts). Always split equally
// among active members; per-person share computed on read.
export const fixedCosts = pgTable("fixed_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(), // cents
  cycle: billingCycleEnum("cycle").notNull(),
  contractHolderId: uuid("contract_holder_id").references(() => members.id).notNull(),
  nextDueAt: timestamp("next_due_at", { withTimezone: true }).notNull(),
  active: boolean("active").notNull().default(true),
});
```

(`boolean` and `timestamp` are already imported in this file's `drizzle-orm/pg-core` import block — no new imports needed.)

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new file under `api/drizzle/` reflecting the two added columns. If this fails because no `DATABASE_URL`/Postgres is reachable, note it in your task report and continue — `drizzle-kit generate` only needs the schema file, not a live DB, so it should normally succeed regardless.

- [ ] **Step 3: Typecheck the api package**

Run: `pnpm --filter @wg/api typecheck`
Expected: FAIL — `api/src/routes/fixedCosts.ts` doesn't set `nextDueAt`/`active` yet on insert/update. This is expected; fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add api/src/db/schema.ts api/drizzle/
git commit -m "feat(api): add next_due_at/active columns to fixed_costs"
```

---

### Task 3: Cycle-advance date helper

**Files:**
- Modify: `api/src/lib/time.ts`

**Interfaces:**
- Consumes: `BillingCycle` from `@wg/shared`.
- Produces: `nextCycleDate(from: Date, cycle: BillingCycle): Date` — `from` advanced by one cycle (month/3 months/year) in Berlin local time, preserving time-of-day and handling month-length overflow the way `dayjs` does (e.g. Jan 31 + 1 month → Feb 28/29, not March).

- [ ] **Step 1: Add the helper**

Add to `api/src/lib/time.ts` (below the existing exports), importing `BillingCycle`:

```typescript
import type { BillingCycle } from "@wg/shared";
```

(add this import at the top of the file, alongside the existing `dayjs`/plugin imports)

```typescript
/**
 * Advance a fixed-cost due date by one billing cycle, in Berlin local time
 * (so DST shifts don't nudge the time-of-day). `quarterly` = 3 months.
 */
export function nextCycleDate(from: Date, cycle: BillingCycle): Date {
  const amount = cycle === "quarterly" ? 3 : 1;
  const unit = cycle === "yearly" ? "year" : "month";
  return dayjs(from).tz(TZ).add(amount, unit).toDate();
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @wg/api typecheck`
Expected: still FAILs on `routes/fixedCosts.ts` (same pre-existing failure from Task 2) — confirm no *new* errors were introduced by this file. Compare the error list to Task 2 Step 3's output; it should be unchanged.

- [ ] **Step 3: Commit**

```bash
git add api/src/lib/time.ts
git commit -m "feat(api): add nextCycleDate billing-cycle helper"
```

---

### Task 4: Fixed-costs route — accept `nextDueAt`/`active`

**Files:**
- Modify: `api/src/routes/fixedCosts.ts`

**Interfaces:**
- Consumes: `createFixedCostSchema`/`updateFixedCostSchema` from Task 1 (now includes `nextDueAt`, `active`).
- Produces: POST/PATCH `/api/fixed-costs` persist and return the two new fields; GET keeps returning them as part of the row spread (no `perPersonShare`-style special-casing needed).

- [ ] **Step 1: Update the insert in POST `/`**

In `app.post("/", ...)`, change the `.values({...})` call:

```typescript
.values({
  name: body.name,
  amount: body.amount,
  cycle: body.cycle,
  contractHolderId: body.contractHolderId,
  nextDueAt: new Date(body.nextDueAt),
  active: body.active,
})
```

- [ ] **Step 2: Update the update in PATCH `/:id`**

In `app.patch("/:id", ...)`, change the `.set({...})` call:

```typescript
.set({
  name: body.name,
  amount: body.amount,
  cycle: body.cycle,
  contractHolderId: body.contractHolderId,
  nextDueAt: new Date(body.nextDueAt),
  active: body.active,
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @wg/api typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/fixedCosts.ts
git commit -m "feat(api): persist nextDueAt/active on fixed cost create/update"
```

---

### Task 5: Fixed-cost generation service

**Files:**
- Create: `api/src/services/fixedCostGeneration.ts`

**Interfaces:**
- Consumes: `db`, `schema` from `api/src/db/client.js`; `logActivity` from `api/src/lib/activity.js`; `resolveShares` from `@wg/shared`; `nextCycleDate` from `api/src/lib/time.js` (Task 3).
- Produces: `export async function runFixedCostGeneration(now = new Date()): Promise<void>` — called by the worker (Task 6) both on a cron schedule and once at startup, matching the signature style of `runMeetingCleanup`/`runMeetingReminders`.

- [ ] **Step 1: Write the service**

```typescript
import { and, eq, isNull, lte } from "drizzle-orm";
import { resolveShares } from "@wg/shared";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { nextCycleDate } from "../lib/time.js";

/**
 * Fixed-cost auto-generation — run daily. Every active fixed cost whose
 * `nextDueAt` has passed gets a matching expense inserted (payer = contract
 * holder, equal split among currently-active members), logged to the
 * activity feed as a system action (memberId: null, reusing the
 * `expense.created` kind), then `nextDueAt` is advanced by one cycle.
 *
 * Catch-up: if the worker was down across multiple cycle boundaries, only
 * ONE expense is generated for the whole gap — `nextDueAt` keeps advancing
 * (in-memory, before the single DB write) until it's back in the future.
 */
export async function runFixedCostGeneration(now = new Date()): Promise<void> {
  const due = await db
    .select()
    .from(schema.fixedCosts)
    .where(and(eq(schema.fixedCosts.active, true), lte(schema.fixedCosts.nextDueAt, now)));

  if (due.length === 0) return;

  const activeMembers = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(isNull(schema.members.archivedAt));

  if (activeMembers.length === 0) {
    console.error("[worker] fixedcost-generation: no active members, skipping this tick");
    return;
  }

  for (const cost of due) {
    let nextDueAt = cost.nextDueAt;
    do {
      nextDueAt = nextCycleDate(nextDueAt, cost.cycle);
    } while (nextDueAt.getTime() <= now.getTime());

    const shares = activeMembers.map((m) => ({ memberId: m.id, value: 1 }));
    const resolved = resolveShares(cost.amount, "equal", shares);

    await db.transaction(async (tx) => {
      const [expense] = await tx
        .insert(schema.expenses)
        .values({
          payerId: cost.contractHolderId,
          amount: cost.amount,
          description: cost.name,
          category: "Fixkosten",
          splitType: "equal",
        })
        .returning();
      await tx.insert(schema.expenseShares).values(
        resolved.map((r) => ({
          expenseId: expense!.id,
          memberId: r.memberId,
          amount: r.amount,
          inputValue: null,
        })),
      );
      await logActivity(tx, {
        memberId: null,
        kind: "expense.created",
        data: { snapshot: { ...expense, shares: resolved } },
      });
      await tx
        .update(schema.fixedCosts)
        .set({ nextDueAt })
        .where(eq(schema.fixedCosts.id, cost.id));
    });
  }

  console.log(`[worker] fixedcost-generation created ${due.length} expense(s)`);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @wg/api typecheck`
Expected: PASS. If `expenseShares`/`expenses`/`members` column names don't match (e.g. `inputValue` vs `input_value` JS property), fix by checking `api/src/db/schema.ts`'s `expenseShares` table definition — the JS property names used above must match exactly what's exported there (they mirror `api/src/routes/expenses.ts`'s own insert, which uses these same names).

- [ ] **Step 3: Commit**

```bash
git add api/src/services/fixedCostGeneration.ts
git commit -m "feat(api): add fixed-cost auto-generation service"
```

---

### Task 6: Wire the cron job

**Files:**
- Modify: `api/src/worker.ts`

**Interfaces:**
- Consumes: `runFixedCostGeneration` from `api/src/services/fixedCostGeneration.js` (Task 5).

- [ ] **Step 1: Add the import**

```typescript
import { runFixedCostGeneration } from "./services/fixedCostGeneration.js";
```

- [ ] **Step 2: Schedule the job + startup catch-up**

Add after the existing `cron.schedule(...)` calls (before the `// Catch up immediately on startup` block):

```typescript
// Fixed-cost generation: daily at 03:00, one expense per due cost
// (catch-up jumps nextDueAt to the next future boundary, no backlog burst).
cron.schedule("0 3 * * *", () => runJob("fixedcost-generation", runFixedCostGeneration));
```

And add to the startup catch-up block (alongside the other `runJob(...)` calls):

```typescript
runJob("fixedcost-generation", runFixedCostGeneration);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @wg/api typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/src/worker.ts
git commit -m "feat(api): schedule fixed-cost generation cron job"
```

---

### Task 7: Web — Fixkosten dialog gets due-date picker + pause toggle

**Files:**
- Modify: `web/src/pages/Fixkosten.tsx`

**Interfaces:**
- Consumes: `CreateFixedCost`/`FixedCostView` from `@wg/shared` (Task 1 — now carry `nextDueAt`/`active`); `useCreateFixedCost`/`useUpdateFixedCost` from `../api/fixedCosts.js` (unchanged signatures, just wider body type); `formatDate` from `../lib/format.js`.
- Produces: dialog collects `nextDueAt` (required date) and `active` (switch, default checked); create/update payloads include both. List cards show the due date and a "Pausiert" chip when `active === false`. The "not linked to Ausgaben" banner is removed.

- [ ] **Step 1: Add imports**

Add to the top of the file:

```typescript
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { formatDate } from "../lib/format.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/** The WG lives in one place — pickers operate in Berlin regardless of device tz. */
const WG_TZ = "Europe/Berlin";
```

Remove the now-unused `Alert` import (`import Alert from "@mui/material/Alert";`) since Step 2 removes its only usage.

- [ ] **Step 2: Remove the standalone banner**

Delete these lines from `Fixkosten()`:

```typescript
      <Alert severity="info" sx={{ mb: 2 }}>
        Reine Übersicht — nicht mit dem Ausgaben-Tab verbunden.
      </Alert>
```

- [ ] **Step 3: Show due date + paused chip on each card**

Replace the per-person-share line's `Stack` (the one with `cycleLabel`, `MemberChip`, and `perPersonShare`) with a version that also shows the due date and a paused chip:

```tsx
<Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
  <Typography variant="caption" color="text.secondary">
    {cycleLabel(c.cycle)} · Vertrag:
  </Typography>
  <MemberChip memberId={c.contractHolderId} />
  <Box sx={{ flex: 1 }} />
  <Typography variant="caption" color="text.secondary">
    pro Person {formatCents(c.perPersonShare)}
  </Typography>
</Stack>
<Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
  <Typography variant="caption" color="text.secondary">
    Fällig: {formatDate(c.nextDueAt)}
  </Typography>
  {!c.active && <Chip label="Pausiert" size="small" />}
</Stack>
```

Add `sx={{ opacity: c.active ? 1 : 0.5 }}` to the outer `<Card key={c.id}>` for the muted-when-paused look (per the design: `<Card key={c.id} sx={{ opacity: c.active ? 1 : 0.5 }}>`).

- [ ] **Step 4: Add `nextDueAt`/`active` state to `FixedCostDialog`**

In `FixedCostDialog`, add state alongside the existing `name`/`amountStr`/`cycle`/`holder`:

```typescript
const [nextDueAt, setNextDueAt] = useState<Dayjs | null>(
  dayjs().tz(WG_TZ).add(1, "month"),
);
const [active, setActive] = useState(true);
```

Update the prefill `useEffect`:

```typescript
useEffect(() => {
  if (value !== "new") {
    setName(value.name);
    setAmountStr((value.amount / 100).toFixed(2).replace(".", ","));
    setCycle(value.cycle);
    setHolder(value.contractHolderId);
    setNextDueAt(dayjs(value.nextDueAt).tz(WG_TZ));
    setActive(value.active);
  }
}, [value]);
```

- [ ] **Step 5: Include the fields in `valid` and `submit`**

```typescript
const valid = name.trim() && amount > 0 && holder && Boolean(nextDueAt);

const submit = () => {
  const body = {
    name: name.trim(),
    amount,
    cycle,
    contractHolderId: holder,
    nextDueAt: nextDueAt!.toISOString(),
    active,
  };
  if (isNew) createM.mutate(body, { onSuccess: onClose });
  else updateM.mutate({ id: (value as FixedCostView).id, body }, { onSuccess: onClose });
};
```

- [ ] **Step 6: Add the picker + switch to the dialog UI, wrap in `LocalizationProvider`**

Wrap the `<Dialog>` return in `FixedCostDialog` with `LocalizationProvider` (matching `MeetingForm.tsx`'s pattern):

```tsx
return (
  <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      {/* ...existing DialogTitle/DialogContent... */}
    </Dialog>
  </LocalizationProvider>
);
```

Inside `DialogContent`'s `<Stack spacing={2} sx={{ mt: 1 }}>`, after the "Vertragspartner:in" `TextField`, add:

```tsx
<DatePicker
  label="Nächste Fälligkeit"
  value={nextDueAt}
  onChange={setNextDueAt}
  timezone={WG_TZ}
/>
<FormControlLabel
  control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
  label={active ? "Aktiv" : "Pausiert"}
/>
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @wg/web typecheck`
Expected: PASS.

- [ ] **Step 8: Build**

Run: `pnpm --filter @wg/web build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src/pages/Fixkosten.tsx
git commit -m "feat(web): add due-date picker and pause toggle to Fixkosten"
```

---

### Task 8: Docs — reflect the new linkage

**Files:**
- Modify: `docs/target-functionality.md`
- Modify: `docs/impl-api.md`
- Modify: `docs/impl-web.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Update `docs/target-functionality.md` §3**

Replace the section (currently lines 62-75, "## 3. Financial Overview (fixed-cost board)") with:

```markdown
## 3. Financial Overview (fixed-cost board)

A cost board that **feeds the ledger automatically**. Each entry both
displays the recurring cost AND generates a matching expense in the
money/ledger system (§2) on its billing cycle.

- Purpose: transparency ("who pays for electricity/gas/internet/rent…,
  how much?") *and* keeping the ledger's fixed costs current without
  manual re-entry.
- A cost board entry has:
  - Name (e.g. Strom, Gas, Internet, Miete)
  - Total amount
  - Billing cycle (monthly / quarterly / yearly)
  - Contract holder (who holds/pays the contract — becomes the payer
    on the generated expense)
  - Next due date (when the next expense is generated)
  - Active/paused toggle (paused costs don't generate)
  - Split rule → **per-person share displayed** (always equal among
    active members)
- On the due date, an expense is auto-created: payer = contract
  holder, split equally among all currently-active members,
  description = the cost's name, category `"Fixkosten"`. It then
  behaves like any other expense — editable, deletable, feeds
  balances.
- Manually maintained otherwise (create/edit/delete the board entry;
  pause instead of deleting to stop generation temporarily).
```

- [ ] **Step 2: Update `docs/target-functionality.md` §8**

In the "Out of scope for v1" list, remove these two bullets (they're no longer true):

```
- Recurring / auto-repeating expenses (the `recurring` flag was dropped; fixed recurring costs live in the standalone Financial Overview, §3)
```

```
- Linking Financial Overview to the ledger
```

- [ ] **Step 3: Update `docs/impl-api.md`**

Find the existing cron/worker documentation section (search for the meeting-reminders/chore-grace cron entries) and add a paragraph describing the new job, referencing `api/src/worker.ts` and `api/src/services/fixedCostGeneration.ts`:

```markdown
### Fixed-cost generation (`fixedCostGeneration.ts`)
Daily at 03:00 Europe/Berlin. For every active fixed cost whose
`nextDueAt` has passed: insert a matching expense (payer = contract
holder, equal split among active members, category `"Fixkosten"`),
log it to the activity feed as a system action (`memberId: null`,
kind `expense.created`), then advance `nextDueAt` by one billing
cycle. If the worker missed multiple cycles while down, `nextDueAt`
is advanced in-memory until it's back in the future but only one
expense is generated for the whole gap (no backdated burst). Runs
once immediately on worker startup as well, for catch-up.
```

- [ ] **Step 4: Update `docs/impl-web.md`**

Find the Fixkosten/Financial-Overview UI documentation section and add a note that the dialog now includes a due-date picker (`@mui/x-date-pickers` `DatePicker`, Berlin-timezoned like `MeetingForm.tsx`) and an active/paused `Switch`, and that the board is no longer flagged as disconnected from Ausgaben.

- [ ] **Step 5: Commit**

```bash
git add docs/target-functionality.md docs/impl-api.md docs/impl-web.md
git commit -m "docs: document Fixkosten auto-expense generation"
```

---

### Task 9: Full workspace verification + manual smoke test

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: PASS across `shared`, `api`, `web`.

- [ ] **Step 2: Full build**

Run: `pnpm build`
Expected: PASS across all three packages.

- [ ] **Step 3: Migrate + manual smoke test (best-effort, requires a reachable Postgres)**

If `DATABASE_URL` points at a reachable Postgres (check `api/.env`):

```bash
pnpm db:migrate
```

Then start the api (`pnpm dev:api` in one terminal) and, via the web UI or `curl`, create one fixed cost with `nextDueAt` set to a timestamp in the past (e.g. yesterday) and `active: true`. Manually invoke generation once — easiest is a one-off script:

```bash
node -e "
const { runFixedCostGeneration } = require('./api/dist/services/fixedCostGeneration.js');
runFixedCostGeneration().then(() => process.exit(0));
"
```

(Requires `pnpm --filter @wg/api build` first so `dist/` exists.) Confirm: a new expense appears in `GET /api/expenses` with `category: "Fixkosten"`, description matching the fixed cost's name, split evenly across active members; the fixed cost's `nextDueAt` (`GET /api/fixed-costs`) has advanced to a future date; and `GET /api/activity` has a new `expense.created` entry with `memberId: null`.

If no Postgres is reachable in this environment, skip this step and note it — it's a best-effort manual check, not a hard gate for the plan.

- [ ] **Step 4: Report**

Summarize: typecheck/build results, and whether the manual smoke test ran (and its outcome) or was skipped (and why).
