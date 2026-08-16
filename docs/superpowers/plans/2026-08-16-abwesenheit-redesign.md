# Abwesenheit (Absence) Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `members.awayUntil` timestamp with a proper `absences` list (multiple past/future ranges per member), surfaced via a new Calendar view on the Termine tab, and wire chore-rotation "away" skipping to read from it.

**Architecture:** New `absences` table + `shared/src/absence.ts` Zod schema, following the exact pattern of existing domains (`members`, `chores`). New `api/src/routes/absences.ts` (list/create/delete, transactional + activity-logged, mirrors `members.ts`). `chores.ts`'s `awaySet()` switches from `members.awayUntil` to a range query against `absences`. Web gets a thin `web/src/api/absences.ts` data-layer file (TanStack Query hooks, same shape as `meetings.ts`), a new `AbsenceCalendar.tsx` component wrapping MUI X `DateCalendar`, a List/Kalender toggle on `Termine.tsx`, an `isAway` swap in `Mitbewohner.tsx`, and removal of the Profil "Abwesenheit" card.

**Tech Stack:** Fastify + Drizzle (Postgres) API, Zod shared schemas, Vite + React 18 + MUI (`@mui/x-date-pickers` `DateCalendar`/`AdapterDayjs`) + TanStack Query web client. pnpm workspace (`shared`/`api`/`web`).

**Spec:** `docs/superpowers/specs/2026-08-16-abwesenheit-design.md`

## Global Constraints

- All timestamps are ISO `datetime({ offset: true })` strings in Zod, `timestamp(..., { withTimezone: true })` in Drizzle — match existing columns exactly.
- German UI copy only (labels, dialog text, buttons) — match the tone of existing pages (`Mitbewohner.tsx`, `Profil.tsx`, `Termine.tsx`).
- Every mutating route wraps its DB writes + its `logActivity` call in one `db.transaction` (see `api/src/routes/members.ts`).
- `activity.kind` must come from `ACTIVITY_KINDS` in `shared/src/activity.ts` — add `"absence.created"` / `"absence.deleted"` there, nowhere else.
- No DB constraint for `from < until` — validated only in the Zod `.refine()` (`createAbsenceSchema`), consistent with how other range checks are done in this codebase.
- No ownership restriction on absence mutation — any member manages any member's absences (matches current `awayUntil` trust model).
- No live Postgres in this environment — `pnpm db:generate` (from `api/`) must be run and its output committed, but `pnpm db:migrate` cannot be verified against a live DB. Say so explicitly, don't claim it was tested.
- No automated test runner exists in this repo (`CLAUDE.md`) — verification per task is `pnpm typecheck` (root) plus, on the final task, `pnpm build` (root) and the manual checks from the spec's Testing section.
- Out of scope (do not build): editing an absence's date range (delete + recreate only), push notifications for absences, recurring absences.

---

## File Structure

| File | Responsibility |
|---|---|
| `shared/src/absence.ts` (new) | `absenceSchema`, `createAbsenceSchema`, `Absence`/`CreateAbsence` types |
| `shared/src/index.ts` (modify) | export `absence.js` |
| `shared/src/member.ts` (modify) | remove `awayUntil` from `memberSchema`/`updateMemberSchema` |
| `shared/src/activity.ts` (modify) | add `"absence.created"` / `"absence.deleted"` to `ACTIVITY_KINDS` |
| `api/src/db/schema.ts` (modify) | remove `members.awayUntil`, add `absences` table |
| `api/src/routes/absences.ts` (new) | `GET /`, `POST /`, `DELETE /:id` |
| `api/src/routes/index.ts` (modify) | register `absencesRoutes` under `/api/absences` |
| `api/src/routes/chores.ts` (modify) | `awaySet()` reads `absences` instead of `members.awayUntil` |
| `api/src/routes/members.ts` (modify) | drop `awayUntil` patch handling |
| `web/src/api/absences.ts` (new) | `absencesApi` + `useAbsences`/`useCreateAbsence`/`useDeleteAbsence` |
| `web/src/api/keys.ts` (modify) | add `absences` query key |
| `web/src/components/AbsenceCalendar.tsx` (new) | `DateCalendar` wrapper with custom day-cell renderer (meeting dots + absence bars) |
| `web/src/pages/Termine.tsx` (modify) | List/Kalender `ToggleButtonGroup`, mounts `AbsenceCalendar` |
| `web/src/pages/Mitbewohner.tsx` (modify) | `isAway(m)` reads absences instead of `m.awayUntil` |
| `web/src/pages/Profil.tsx` (modify) | remove the "Away" section + its state |

---

### Task 1: Shared schema — `absences` + activity kinds + member cleanup

**Files:**
- Create: `shared/src/absence.ts`
- Modify: `shared/src/index.ts`
- Modify: `shared/src/activity.ts`
- Modify: `shared/src/member.ts`

**Interfaces:**
- Produces: `absenceSchema: ZodObject` → `Absence { id, memberId, from, until, createdAt }` (all ISO strings except `id`/`memberId` which are `uuid`).
- Produces: `createAbsenceSchema: ZodEffects` → `CreateAbsence { memberId, from, until }`, refined so `from < until`.
- Produces: `ACTIVITY_KINDS` now includes `"absence.created"`, `"absence.deleted"`.
- Consumed by: Task 2 (Drizzle `absences` table mirrors these fields), Task 3 (API route), Task 6 (web data layer).

- [ ] **Step 1: Write `shared/src/absence.ts`**

```ts
import { z } from "zod";
import { uuid } from "./common.js";

export const absenceSchema = z.object({
  id: uuid,
  memberId: uuid,
  from: z.string().datetime({ offset: true }),
  until: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
});
export type Absence = z.infer<typeof absenceSchema>;

export const createAbsenceSchema = z
  .object({
    memberId: uuid,
    from: z.string().datetime({ offset: true }),
    until: z.string().datetime({ offset: true }),
  })
  .refine((v) => new Date(v.from) < new Date(v.until), {
    message: "from must be before until",
  });
export type CreateAbsence = z.infer<typeof createAbsenceSchema>;
```

- [ ] **Step 2: Export it from `shared/src/index.ts`**

Add, after the `member.js` line (keep the file's existing alphabetically-loose grouping — just append at the end so the diff is a single added line):

```ts
export * from "./absence.js";
```

- [ ] **Step 3: Add the two new activity kinds**

In `shared/src/activity.ts`, in the `ACTIVITY_KINDS` array, add two entries. Put them right after `"member.restored"` (they're member-adjacent, same as the design doc groups them):

```ts
  "member.restored",
  "absence.created",
  "absence.deleted",
  "expense.created",
```

- [ ] **Step 4: Remove `awayUntil` from the member schemas**

In `shared/src/member.ts`, delete the `awayUntil` field from `memberSchema` and from `updateMemberSchema`, and simplify the latter's `.refine()` since it only has one optional field left:

```ts
export const memberSchema = z.object({
  id: uuid,
  displayName: z.string().min(1).max(60),
  archivedAt: z.string().datetime({ offset: true }).nullable(),
});
export type Member = z.infer<typeof memberSchema>;

export const createMemberSchema = z.object({
  displayName: z.string().min(1).max(60),
});
export type CreateMember = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = z.object({
  displayName: z.string().min(1).max(60),
});
export type UpdateMember = z.infer<typeof updateMemberSchema>;
```

(`queryBool` import stays — still used by `memberQuerySchema` below it.)

- [ ] **Step 5: Build `shared` and typecheck**

Run from repo root:
```bash
pnpm --filter @wg/shared build
pnpm --filter @wg/shared typecheck
```
Expected: both succeed with no errors. (`api`/`web` will fail typecheck until later tasks catch up — that's expected here, don't chase it yet.)

- [ ] **Step 6: Commit**

```bash
git add shared/src/absence.ts shared/src/index.ts shared/src/activity.ts shared/src/member.ts
git commit -m "feat(shared): add absence schema, remove member.awayUntil"
```

---

### Task 2: Drizzle schema — `absences` table, drop `members.awayUntil`

**Files:**
- Modify: `api/src/db/schema.ts`
- Generated (by Step 2 below): `api/drizzle/000X_*.sql`, `api/drizzle/meta/000X_snapshot.json`, `api/drizzle/meta/_journal.json`

**Interfaces:**
- Consumes: nothing from other tasks (Drizzle schema is independent of `@wg/shared` at the type level — enum values come from `@wg/shared` already, per the file's existing pattern).
- Produces: `schema.absences` Drizzle table with columns `id`, `memberId`, `from`, `until`, `createdAt` — consumed by Task 3 (`absences.ts` route) and Task 4 (`chores.ts` `awaySet()`).

- [ ] **Step 1: Edit `api/src/db/schema.ts`**

Remove the `awayUntil` line from `members`:

```ts
export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

Add a new `absences` table. Put it right after `members` (before `devices`), since it's a member-adjacent core table:

```ts
export const absences = pgTable("absences", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .references(() => members.id, { onDelete: "cascade" })
    .notNull(),
  from: timestamp("from", { withTimezone: true }).notNull(),
  until: timestamp("until", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Generate the migration**

Run from `api/`:
```bash
pnpm db:generate
```
Expected: a new `api/drizzle/000X_<name>.sql` containing `DROP COLUMN away_until` on `members` and `CREATE TABLE absences (...)` with an FK to `members(id)` `ON DELETE CASCADE`, plus a matching `api/drizzle/meta/000X_snapshot.json` and an updated `_journal.json`. Read the generated SQL file to confirm both changes are present before moving on.

Note: `pnpm db:migrate` is NOT run here — there is no live Postgres in this environment. The migration file is committed as-is; applying it is the deploy step's job.

- [ ] **Step 3: Typecheck `api`**

```bash
pnpm --filter @wg/api typecheck
```
Expected: fails at this point — `members.ts` and `chores.ts` still reference `schema.members.awayUntil` / `body.awayUntil`. That's expected; Tasks 3–4 fix it. Just confirm the *only* errors are those two known references (no unrelated schema-shape errors from the `absences` table itself).

- [ ] **Step 4: Commit**

```bash
git add api/src/db/schema.ts api/drizzle
git commit -m "feat(api): add absences table, drop members.away_until"
```

---

### Task 3: API route — `api/src/routes/absences.ts`

**Files:**
- Create: `api/src/routes/absences.ts`
- Modify: `api/src/routes/index.ts`

**Interfaces:**
- Consumes: `schema.absences` (Task 2), `createAbsenceSchema`/`idParamSchema` (`@wg/shared`, Task 1), `logActivity`/`Tx` (`api/src/lib/activity.ts`), `parse` (`api/src/lib/parse.ts`), `NotFoundError` (`api/src/lib/errors.ts`), `requireMember` (`api/src/plugins/auth.ts`).
- Produces: `absencesRoutes(app: FastifyInstance)` registered at `/api/absences` — `GET /?memberId=` (optional filter, sorted by `from` ascending), `POST /` (201, returns the created row), `DELETE /:id` (204). Consumed by Task 6 (`web/src/api/absences.ts`).

- [ ] **Step 1: Write `api/src/routes/absences.ts`**

```ts
import { createAbsenceSchema, idParamSchema, uuid } from "@wg/shared";
import { asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { requireMember } from "../plugins/auth.js";

const listQuerySchema = z.object({ memberId: uuid.optional() });

export async function absencesRoutes(app: FastifyInstance) {
  // List absences, optionally filtered by member, sorted by start.
  app.get("/", async (req) => {
    const { memberId } = parse(listQuerySchema, req.query);
    return db
      .select()
      .from(schema.absences)
      .where(memberId ? eq(schema.absences.memberId, memberId) : undefined)
      .orderBy(asc(schema.absences.from));
  });

  // Plan an absence.
  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const body = parse(createAbsenceSchema, req.body);
    const absence = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.absences)
        .values({
          memberId: body.memberId,
          from: new Date(body.from),
          until: new Date(body.until),
        })
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "absence.created",
        data: { snapshot: row },
      });
      return row!;
    });
    return reply.status(201).send(absence);
  });

  // Cancel a planned/past absence (delete + recreate is the only "edit" path).
  app.delete("/:id", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.absences)
        .where(eq(schema.absences.id, id));
      if (!before) throw new NotFoundError("absence not found");

      await tx.delete(schema.absences).where(eq(schema.absences.id, id));
      await logActivity(tx, {
        memberId: actor.id,
        kind: "absence.deleted",
        data: { snapshot: before },
      });
    });
    return reply.status(204).send();
  });
}
```

- [ ] **Step 2: Register the route in `api/src/routes/index.ts`**

Add the import (alphabetically, after the `activityRoutes` import block — keep the file's existing alphabetical-by-symbol ordering):

```ts
import { absencesRoutes } from "./absences.js";
import { activityRoutes } from "./activity.js";
```

Add the registration inside the protected block, alongside the other domain routes (after `membersRoutes`, since absences are member-adjacent):

```ts
    await protectedApp.register(membersRoutes, { prefix: "/api/members" });
    await protectedApp.register(absencesRoutes, { prefix: "/api/absences" });
```

- [ ] **Step 3: Typecheck `api`**

```bash
pnpm --filter @wg/api typecheck
```
Expected: no new errors from `absences.ts` or `routes/index.ts` (the pre-existing `members.ts`/`chores.ts` `awayUntil` errors from Task 2 are still expected here).

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/absences.ts api/src/routes/index.ts
git commit -m "feat(api): add /api/absences routes"
```

---

### Task 4: API — chore rotation reads `absences`, members route drops `awayUntil`

**Files:**
- Modify: `api/src/routes/chores.ts`
- Modify: `api/src/routes/members.ts`

**Interfaces:**
- Consumes: `schema.absences` (Task 2).
- Produces: `awaySet(tx, now)` unchanged signature (`Promise<Set<string>>`), still consumed internally by `openNextTurn` and the `POST /:id` handler in the same file — no external callers change.

- [ ] **Step 1: Update `awaySet` in `api/src/routes/chores.ts`**

Replace the `gt` import usage (a member is away if any absence row spans `now`) and the function body:

```ts
import { and, eq, isNull, lte, gte } from "drizzle-orm";
```

(`gt` is no longer used anywhere in this file — replace it outright, don't leave it imported unused. `lte`/`gte` are the two new comparisons needed.)

```ts
/** Member ids currently away (an absence row spans `now`). */
async function awaySet(tx: Tx, now: Date): Promise<Set<string>> {
  const rows = await tx
    .select({ memberId: schema.absences.memberId })
    .from(schema.absences)
    .where(and(lte(schema.absences.from, now), gte(schema.absences.until, now)));
  return new Set(rows.map((r) => r.memberId));
}
```

- [ ] **Step 2: Verify no other reference to `members.awayUntil` remains in `chores.ts`**

Search the file for `awayUntil` — there should be none left (the only prior usage was inside the old `awaySet` body just replaced).

- [ ] **Step 3: Remove `awayUntil` patch handling from `api/src/routes/members.ts`**

In the `PATCH /:id` handler, remove the `awayUntil` branch so the patch body only handles `displayName`:

```ts
      const patch: Partial<typeof schema.members.$inferInsert> = {};
      if (body.displayName !== undefined) patch.displayName = body.displayName;
```

(Delete the `if (body.awayUntil !== undefined) { ... }` block entirely — `updateMemberSchema` no longer has that field per Task 1, so `body.awayUntil` would now be a type error anyway.)

- [ ] **Step 4: Typecheck and build `api`**

```bash
pnpm --filter @wg/api typecheck
pnpm --filter @wg/api build
```
Expected: both succeed with zero errors — this closes out all `awayUntil` references on the API side.

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/chores.ts api/src/routes/members.ts
git commit -m "feat(api): chore rotation away-check reads absences table"
```

---

### Task 5: Web data layer — `web/src/api/absences.ts`

**Files:**
- Create: `web/src/api/absences.ts`
- Modify: `web/src/api/keys.ts`

**Interfaces:**
- Consumes: `Absence`/`CreateAbsence` (`@wg/shared`, Task 1), `http` (`web/src/api/client.ts`), `qk` (`web/src/api/keys.ts`).
- Produces: `absencesApi.{list,create,remove}`, `useAbsences(memberId?)`, `useCreateAbsence()`, `useDeleteAbsence()`. Consumed by Task 6 (`AbsenceCalendar.tsx`) and Task 8 (`Mitbewohner.tsx`).

- [ ] **Step 1: Add the query key in `web/src/api/keys.ts`**

```ts
  absences: (memberId?: string) => ["absences", { memberId: memberId ?? null }] as const,
  absencesAll: ["absences"] as const,
```

Add these two lines after the `meeting: (id: string) => ...` line, grouped with the other list/detail key pairs.

- [ ] **Step 2: Write `web/src/api/absences.ts`**

```ts
import type { Absence, CreateAbsence } from "@wg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./client.js";
import { qk } from "./keys.js";

export const absencesApi = {
  list: (memberId?: string) =>
    http<Absence[]>(`/api/absences${memberId ? `?memberId=${memberId}` : ""}`),
  create: (body: CreateAbsence) =>
    http<Absence>("/api/absences", { method: "POST", body: JSON.stringify(body) }),
  remove: (id: string) => http<void>(`/api/absences/${id}`, { method: "DELETE" }),
};

export function useAbsences(memberId?: string) {
  return useQuery({
    queryKey: qk.absences(memberId),
    queryFn: () => absencesApi.list(memberId),
  });
}

export function useCreateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: absencesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.absencesAll });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export function useDeleteAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: absencesApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.absencesAll });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}
```

- [ ] **Step 3: Typecheck `web`**

```bash
pnpm --filter @wg/web typecheck
```
Expected: no errors from `absences.ts`/`keys.ts` (pre-existing `Mitbewohner.tsx`/`Profil.tsx` `awayUntil` errors from Task 1's `member.ts` change are still expected here — Tasks 7–8 fix them).

- [ ] **Step 4: Commit**

```bash
git add web/src/api/absences.ts web/src/api/keys.ts
git commit -m "feat(web): add absences data layer"
```

---

### Task 6: Web — `AbsenceCalendar.tsx` component

**Files:**
- Create: `web/src/components/AbsenceCalendar.tsx`

**Interfaces:**
- Consumes: `useAbsences` (Task 5), `useMeetings` (`web/src/api/meetings.ts`, already exists), `useMemberColor`/`useColorMap` (`web/src/theme/useMemberColor.ts`), `useMembersMap` (`web/src/api/members.ts`), `MUI X DateCalendar`/`PickersDay`/`AdapterDayjs`/`LocalizationProvider`.
- Produces: `<AbsenceCalendar />` — self-contained, no props (fetches its own data). Consumed by Task 7 (`Termine.tsx`).

- [ ] **Step 1: Write `web/src/components/AbsenceCalendar.tsx`**

```tsx
import Box from "@mui/material/Box";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickersDay, type PickersDayProps } from "@mui/x-date-pickers/PickersDay";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { useAbsences } from "../api/absences.js";
import { useMeetings } from "../api/meetings.js";
import { useColorMap } from "../theme/useMemberColor.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/** The WG lives in one place — operate on Berlin days regardless of device tz. */
const WG_TZ = "Europe/Berlin";

function DayCell(
  props: PickersDayProps<Dayjs> & {
    meetingDays: Set<string>;
    absenceBarsByDay: Map<string, string[]>;
    colors: Map<string, { main: string; soft: string; ink: string }>;
  },
) {
  const { meetingDays, absenceBarsByDay, colors, day, ...other } = props;
  const key = day.tz(WG_TZ).format("YYYY-MM-DD");
  const bars = absenceBarsByDay.get(key) ?? [];
  const hasMeeting = meetingDays.has(key);

  return (
    <Box sx={{ position: "relative" }}>
      <PickersDay {...other} day={day} />
      <Box
        sx={{
          position: "absolute",
          bottom: 2,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1px",
          pointerEvents: "none",
        }}
      >
        {hasMeeting && (
          <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "primary.main" }} />
        )}
        {bars.length > 0 && (
          <Box sx={{ display: "flex", gap: "1px" }}>
            {bars.slice(0, 4).map((memberId) => (
              <Box
                key={memberId}
                sx={{
                  width: 3,
                  height: 3,
                  bgcolor: colors.get(memberId)?.main ?? "text.disabled",
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** Calendar overview of meetings (dots) + member absences (colored bars). */
export function AbsenceCalendar() {
  const absences = useAbsences();
  const meetings = useMeetings();
  const colors = useColorMap();

  const meetingDays = new Set(
    (meetings.data ?? [])
      .filter((m) => m.startsAt)
      .map((m) => dayjs(m.startsAt!).tz(WG_TZ).format("YYYY-MM-DD")),
  );

  const absenceBarsByDay = new Map<string, string[]>();
  for (const a of absences.data ?? []) {
    let d = dayjs(a.from).tz(WG_TZ).startOf("day");
    const end = dayjs(a.until).tz(WG_TZ).startOf("day");
    while (d.isSame(end) || d.isBefore(end)) {
      const key = d.format("YYYY-MM-DD");
      const existing = absenceBarsByDay.get(key) ?? [];
      if (!existing.includes(a.memberId)) existing.push(a.memberId);
      absenceBarsByDay.set(key, existing);
      d = d.add(1, "day");
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
      <DateCalendar
        timezone={WG_TZ}
        readOnly
        slots={{ day: DayCell }}
        slotProps={{
          day: { meetingDays, absenceBarsByDay, colors } as never,
        }}
      />
    </LocalizationProvider>
  );
}
```

- [ ] **Step 2: Typecheck `web`**

```bash
pnpm --filter @wg/web typecheck
```
Expected: no errors from `AbsenceCalendar.tsx` itself (the pre-existing `Mitbewohner.tsx`/`Profil.tsx` errors persist until Tasks 7–8).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AbsenceCalendar.tsx
git commit -m "feat(web): add AbsenceCalendar component"
```

---

### Task 7: Web — Termine tab List/Kalender toggle + absence planning FAB

**Files:**
- Modify: `web/src/pages/Termine.tsx`

**Interfaces:**
- Consumes: `AbsenceCalendar` (Task 6), `useAbsences`/`useCreateAbsence`/`useDeleteAbsence` (Task 5), `useMembers`/`useMembersMap` (`web/src/api/members.ts`), `useIdentity` (`web/src/api/identity.ts`), `formatDate` (`web/src/lib/format.ts`).
- Produces: updated `Termine` page — the existing list view is unchanged behavior-wise; a new Kalender view is added behind the toggle. No exports change (still `export function Termine()`), so no other file needs updates.

- [ ] **Step 1: Rewrite `web/src/pages/Termine.tsx`**

```tsx
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import HowToVoteRoundedIcon from "@mui/icons-material/HowToVoteRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Fab from "@mui/material/Fab";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAbsences, useCreateAbsence, useDeleteAbsence } from "../api/absences.js";
import { useIdentity } from "../api/identity.js";
import { useMeetings } from "../api/meetings.js";
import { useMembers, useMembersMap } from "../api/members.js";
import { AbsenceCalendar } from "../components/AbsenceCalendar.js";
import { AddFab } from "../components/Fab.js";
import { EmptyState } from "../components/EmptyState.js";
import { ParticipationChips } from "../components/ParticipationChips.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
import { formatDate, formatDateTime } from "../lib/format.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/** The WG lives in one place — operate on Berlin days regardless of device tz. */
const WG_TZ = "Europe/Berlin";

const MODE = {
  fixed: { label: "Termin", icon: <EventRoundedIcon fontSize="small" /> },
  recurring: { label: "Wiederkehrend", icon: <RepeatRoundedIcon fontSize="small" /> },
  poll: { label: "Umfrage", icon: <HowToVoteRoundedIcon fontSize="small" /> },
};

export function Termine() {
  const navigate = useNavigate();
  const meetings = useMeetings();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [planOpen, setPlanOpen] = useState(false);

  const sorted = [...(meetings.data ?? [])].sort((a, b) => {
    const ta = a.startsAt ? dayjs(a.startsAt).valueOf() : Infinity;
    const tb = b.startsAt ? dayjs(b.startsAt).valueOf() : Infinity;
    return ta - tb;
  });

  return (
    <Box sx={{ p: 2 }}>
      <ToggleButtonGroup
        value={view}
        exclusive
        onChange={(_e, v) => v && setView(v)}
        size="small"
        sx={{ mb: 2 }}
      >
        <ToggleButton value="list">Liste</ToggleButton>
        <ToggleButton value="calendar">Kalender</ToggleButton>
      </ToggleButtonGroup>

      {view === "list" ? (
        sorted.length > 0 ? (
          <Stack spacing={1.5}>
            {sorted.map((m) => {
              const mode = MODE[m.mode];
              return (
                <Card key={m.id}>
                  <CardActionArea sx={{ p: 2 }} onClick={() => navigate(`/termine/${m.id}`)}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="h6" sx={{ flex: 1 }}>{m.title}</Typography>
                      <Chip icon={mode.icon} label={mode.label} size="small" variant="outlined" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {m.startsAt ? formatDateTime(m.startsAt) : "Noch kein Termin — abstimmen"}
                    </Typography>
                    {m.startsAt && (
                      <>
                        <Divider sx={{ my: 1.5 }} />
                        <ParticipationChips rsvps={m.rsvps} />
                      </>
                    )}
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
        ) : (
          <EmptyState title="Keine Termine" hint="Plane ein Treffen oder starte eine Umfrage." />
        )
      ) : (
        <CalendarView onPlan={() => setPlanOpen(true)} />
      )}

      {view === "list" && (
        <AddFab label="Termin hinzufügen" onClick={() => navigate("/termine/neu")} />
      )}
      {view === "calendar" && (
        <Fab
          color="primary"
          aria-label="Abwesenheit planen"
          onClick={() => setPlanOpen(true)}
          sx={{ position: "fixed", bottom: 80, right: 16, zIndex: 1200 }}
        >
          <EventRoundedIcon />
        </Fab>
      )}

      <PlanAbsenceDialog open={planOpen} onClose={() => setPlanOpen(false)} />
    </Box>
  );
}

function CalendarView({ onPlan }: { onPlan: () => void }) {
  const { memberId } = useIdentity();
  const absences = useAbsences(memberId ?? undefined);
  const remove = useDeleteAbsence();
  const now = dayjs();

  const mine = [...(absences.data ?? [])]
    .filter((a) => dayjs(a.until).isAfter(now))
    .sort((a, b) => dayjs(a.from).valueOf() - dayjs(b.from).valueOf());

  return (
    <Box>
      <Card sx={{ p: 1 }}>
        <AbsenceCalendar />
      </Card>

      <Typography variant="overline" sx={{ color: "text.secondary", display: "block", mt: 3, mb: 1 }}>
        Meine Abwesenheiten
      </Typography>
      {mine.length > 0 ? (
        <Card sx={{ px: 1 }}>
          {mine.map((a, i) => (
            <Stack
              key={a.id}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{
                py: 1,
                borderTop: i === 0 ? "none" : "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography sx={{ flex: 1 }}>
                {formatDate(a.from)} – {formatDate(a.until)}
              </Typography>
              <IconButton size="small" onClick={() => remove.mutate(a.id)}>
                <DeleteRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Card>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Keine geplanten Abwesenheiten.
        </Typography>
      )}

      <Box sx={{ mt: 2 }}>
        <Button onClick={onPlan}>Abwesenheit planen</Button>
      </Box>
    </Box>
  );
}

function PlanAbsenceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { memberId } = useIdentity();
  const members = useMembers();
  const create = useCreateAbsence();
  const [selectedMember, setSelectedMember] = useState(memberId ?? "");
  const [from, setFrom] = useState<Dayjs | null>(dayjs().tz(WG_TZ));
  const [until, setUntil] = useState<Dayjs | null>(dayjs().tz(WG_TZ).add(7, "day"));

  const valid = selectedMember && from && until && from.isBefore(until) && !create.isPending;

  const submit = () => {
    if (!valid || !from || !until) return;
    create.mutate(
      {
        memberId: selectedMember,
        from: from.tz(WG_TZ).startOf("day").toISOString(),
        until: until.tz(WG_TZ).endOf("day").toISOString(),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Abwesenheit planen</DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Mitbewohner:in"
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              fullWidth
            >
              {(members.data ?? []).map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.displayName}</MenuItem>
              ))}
            </TextField>
            <DatePicker label="Von" value={from} onChange={setFrom} timezone={WG_TZ} />
            <DatePicker label="Bis" value={until} onChange={setUntil} timezone={WG_TZ} minDate={from ?? undefined} />
          </Stack>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" disabled={!valid} onClick={submit}>
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

Note: `MemberAvatar` is imported but unused in the snippet above if you don't add avatars to the list rows — remove that import if your editor flags it, or keep the list rows text-only per the code above (drop the `MemberAvatar` import to avoid an unused-import typecheck error, since `noUnusedLocals`-style strictness may be on — check `tsconfig.json` `compilerOptions` if unsure; safest is to just not import it).

- [ ] **Step 2: Typecheck `web`**

```bash
pnpm --filter @wg/web typecheck
```
Expected: no errors from `Termine.tsx`.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Termine.tsx
git commit -m "feat(web): add Kalender view + absence planning to Termine tab"
```

---

### Task 8: Web — Mitbewohner `isAway` reads absences

**Files:**
- Modify: `web/src/pages/Mitbewohner.tsx`

**Interfaces:**
- Consumes: `useAbsences` (Task 5).
- Produces: same `isAway(m: Member): boolean` behavior, now sourced from the absences list instead of `m.awayUntil`.

- [ ] **Step 1: Edit `web/src/pages/Mitbewohner.tsx`**

Add the import:

```ts
import { useAbsences } from "../api/absences.js";
```

Inside `Mitbewohner()`, add the absences fetch and replace `isAway`:

```ts
  const absences = useAbsences();
  const now = dayjs();
  const awayMemberIds = new Set(
    (absences.data ?? [])
      .filter((a) => dayjs(a.from).isBefore(now) && dayjs(a.until).isAfter(now))
      .map((a) => a.memberId),
  );
  const isAway = (m: Member) => awayMemberIds.has(m.id);
```

Remove the old line:

```ts
  const isAway = (m: Member) => m.awayUntil && dayjs(m.awayUntil).isAfter(dayjs());
```

- [ ] **Step 2: Typecheck `web`**

```bash
pnpm --filter @wg/web typecheck
```
Expected: no errors from `Mitbewohner.tsx`.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Mitbewohner.tsx
git commit -m "feat(web): Mitbewohner away-chip reads absences"
```

---

### Task 9: Web — remove Profil "Abwesenheit" card

**Files:**
- Modify: `web/src/pages/Profil.tsx`

**Interfaces:**
- Consumes: nothing new. Removes the last `awayUntil` reference in the web package.
- Produces: `Profil()` unchanged signature, section removed.

- [ ] **Step 1: Remove the Away section and its state from `web/src/pages/Profil.tsx`**

Delete the entire `{/* Away */}` `<Box>` block (the section between `{/* Notifications */}`'s closing `</Box>` and `{/* Danger zone */}`'s opening `<Box>`).

Delete the `away` state and `saveAway` function:

```ts
  const [away, setAway] = useState<Dayjs | null>(
    me?.awayUntil ? dayjs(me.awayUntil).tz(WG_TZ) : null,
  );
  ...
  const saveAway = (value: Dayjs | null) => {
    setAway(value);
    if (!memberId) return;
    update.mutate({ id: memberId, body: { awayUntil: value ? value.tz(WG_TZ).endOf("day").toISOString() : null } });
  };
```

Remove now-unused imports: `LocalizationProvider`, `AdapterDayjs`, `DatePicker`, `dayjs`/`Dayjs` (check if `dayjs` is still used elsewhere in the file — it is not, once `away`/`saveAway` are gone), `utc`/`timezone` plugin imports, the `WG_TZ` constant, and `useUpdateMember` if `update` is no longer referenced anywhere else in the component (check — `update` was only used by `saveAway`, so remove that import too, along with `useMembersMap`'s `me` variable's now-sole other use... verify `me` is still used by the Identity section's `me?.displayName` — it is, so keep `useMembersMap`/`me`).

After removal, the top of the file's imports should read:

```tsx
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client.js";
import { clearIdentity, setMemberId, useIdentity } from "../api/identity.js";
import { useMembersMap } from "../api/members.js";
import { wgApi } from "../api/wg.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
import { SectionLabel } from "../components/SectionLabel.js";
import {
  isIOS,
  isStandalone,
  pushSupported,
  registerPush,
  type PushResult,
} from "../lib/push.js";
```

And `Profil()`'s body starts:

```tsx
export function Profil() {
  const { memberId } = useIdentity();
  const members = useMembersMap();
  const me = memberId ? members.get(memberId) : undefined;

  const [pushState, setPushState] = useState<PushResult | "pending" | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const needsInstall = isIOS() && !isStandalone();
```

(everything else in the component — Identity card, Notifications card, Danger zone, `ResetDialog` — is unchanged.)

- [ ] **Step 2: Typecheck `web`**

```bash
pnpm --filter @wg/web typecheck
```
Expected: succeeds with zero errors — this is the last file in the web package touching `awayUntil`.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Profil.tsx
git commit -m "feat(web): remove Abwesenheit card from Profil"
```

---

### Task 10: Full-repo verification

**Files:** none (verification only).

**Interfaces:** none — this task runs the full build/typecheck across all three packages and performs the spec's manual-verification checklist against a running dev server (Postgres permitting).

- [ ] **Step 1: Typecheck everything**

```bash
pnpm typecheck
```
Expected: zero errors across `shared`, `api`, `web`.

- [ ] **Step 2: Build everything**

```bash
pnpm build
```
Expected: all three packages build cleanly.

- [ ] **Step 3: Grep for stray `awayUntil` references**

```bash
grep -rn "awayUntil" shared/src api/src web/src
```
Expected: no output. If anything remains, it's a missed call site from Tasks 1–9 — fix it before continuing.

- [ ] **Step 4: Manual verification (requires a running Postgres + `pnpm db:migrate` applied)**

If a Postgres instance is available: run `pnpm db:migrate` (from `api/`), start the stack (`pnpm dev`), and:
- Create a future-dated absence via the Termine → Kalender FAB → confirm it renders as a colored bar on the calendar and produces the "Abwesend" chip on that member's Mitbewohner row once the range includes today.
- Confirm a chore turn evaluated while a member's absence window is active correctly skips that member (per `docs/chore-rota-redesign.md`'s "Away" section — executor override, `rotationIndex` unchanged).
- Confirm the Profil page no longer shows an "Abwesenheit" card.

If no Postgres is available in this environment, state that explicitly instead of claiming this step passed.

- [ ] **Step 5: Commit (only if Step 3/4 required fixes)**

If Steps 1–4 required any additional fixes beyond what Tasks 1–9 already committed, stage and commit them now with a message describing what was missed. If nothing needed fixing, skip this step — there's nothing to commit.
