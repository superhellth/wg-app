# Abwesenheit (Absence) Redesign — Design

Status: approved, pending implementation plan.
Date: 2026-08-16

## Problem

Today `members.awayUntil` is a single nullable timestamp, editable only from a
buried card on the Profil page. It only supports "away starting now, until
X" — no future-planned absences, no history, no shared overview. The user
wants to plan absences ahead of time and see them alongside meetings.

## Decision summary

- Absences become a **list** (`absences` table), not a single field — each
  member can have multiple past/future ranges.
- No dedicated top-level menu item. Instead, absence planning + overview
  lives in the **Termine** tab via a new **Calendar view** (toggle next to
  the existing list), built on **MUI X `DateCalendar`** (already a
  dependency via `@mui/x-date-pickers`) with a custom day-cell renderer.
- The Profil "Abwesenheit" card is removed.
- No live Postgres data exists yet and no migrations have been generated
  (`pnpm db:generate` was never run) — `awayUntil` can be replaced outright,
  no backfill/migration-of-data concern.

## Data model

`api/src/db/schema.ts`:

- Remove `members.awayUntil`.
- Add `absences` table:
  - `id` (uuid, pk)
  - `memberId` (uuid, fk → members.id, cascade delete)
  - `from` (timestamptz, not null)
  - `until` (timestamptz, not null)
  - `createdAt` (timestamptz, default now)
  - Application-level invariant: `from < until` (checked in the route, not a
    DB constraint, consistent with how other range checks are done in this
    codebase).

`shared/src/absence.ts` (new):

```ts
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

Export both from `shared/src/index.ts`.

Remove `awayUntil` from `memberSchema` / `updateMemberSchema` in
`shared/src/member.ts`.

## API (`api/src/routes/absences.ts`, new)

Registered under `/api/absences` in `api/src/routes/index.ts`.

- `GET /api/absences?memberId=` — list absences, optionally filtered by
  member, sorted by `from`.
- `POST /api/absences` — `safeParse(createAbsenceSchema)`, insert, write
  `activity` row (`kind: "absence.created"`), all in one `db.transaction`.
- `DELETE /api/absences/:id` — delete, write `activity` row
  (`kind: "absence.deleted"`), one transaction.

No ownership restriction — same trust model as the rest of the app (any
member can manage any member's absence, matching how `awayUntil` edits work
today).

Add `"absence.created"` / `"absence.deleted"` to the `ACTIVITY_KINDS`
vocab in `shared`.

## Chore rotation integration

`api/src/routes/chores.ts:43-48` currently selects members where
`awayUntil > now`. Replace with a query against `absences`: a member is
"away" at evaluation time if a row exists where `from <= now <= until`.
Skip semantics are unchanged (`docs/chore-rota-redesign.md` "Away" section
still applies as-is — away member skipped, next present neighbor executes,
`rotationIndex` advances normally).

## Web

### `web/src/api/absences.ts` (new)

TanStack Query hooks following the existing per-domain pattern
(`useAbsences(memberId?)`, `useCreateAbsence()`, `useDeleteAbsence()`), plus
a `keys.ts` entry.

### Termine tab (`web/src/pages/Termine.tsx`)

- Add a `ToggleButtonGroup` (List / Kalender) above the content, local
  component state, list stays the default view.
- Calendar view: new `web/src/components/AbsenceCalendar.tsx` wrapping MUI X
  `DateCalendar` (`AdapterDayjs`, `Europe/Berlin` timezone like the existing
  `DatePicker` usage in Profil today). Custom `slots.day` renderer shows:
  - a small dot per meeting whose `startsAt` falls on that day,
  - a thin colored bar per member absent that day, colored via
    `useMemberColor` (the existing per-member color signature).
- A FAB ("Abwesenheit planen", visible only in Calendar mode) opens a
  dialog: member `Select` (defaults to the signed-in member), start/end
  `DatePicker`s → `POST /api/absences`.
- Below the calendar, a compact list of the signed-in member's
  upcoming/current absences with a delete (trash icon) action per row.

### Mitbewohner tab (`web/src/pages/Mitbewohner.tsx`)

`isAway(m)` (`web/src/pages/Mitbewohner.tsx:54`) switches from checking
`m.awayUntil` to checking whether any fetched absence for that member has
`from <= now <= until`. The "Abwesend" chip behavior is unchanged.

### Profil tab (`web/src/pages/Profil.tsx`)

Remove the entire "Away" section (lines ~123-143) and its `away`/`saveAway`
state — absence management no longer lives here.

## Testing

No automated test runner is configured in this repo yet (per `CLAUDE.md`).
Manual verification: create a future-dated absence, confirm it renders on
the calendar and in Mitbewohner's chip; confirm a chore turn during an
active absence window skips that member correctly.

## Out of scope

- Editing an absence's date range after creation (delete + recreate only).
- Push notifications for absences (absence stays feed/calendar-only, no
  push — consistent with the "push is chores + meetings only" invariant;
  an absence itself is not a push-worthy event).
- Recurring/repeating absences.
