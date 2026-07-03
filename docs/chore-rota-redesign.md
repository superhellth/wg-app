# Chore system redesign — coupled weekly rota

> **Status: locked design, not yet implemented.** Replaces the generic chore
> engine (per-chore `frequency` weekly/biweekly/custom + independent rotations +
> advance-on-completion). Supersedes the chore mechanics described in
> `target-functionality.md` / `impl-api.md`; update those when this ships.

## Concept

One WG, one shared **rotation** (ordered list of members). A small editable set
of weekly **tasks** (e.g. bathroom, kitchen, glass, trash) is passed around that
rotation in fixed order. All tasks share the one rotation, each offset by a
different starting position so they spread across members.

Assignment is **calendar-locked**:

```
assignee(task, week w) = roster[(w + offset_task) % n]
```

Consecutive weeks map to consecutive members (A, B, C, D, A, …). This sequence
**never drifts** — every skip mechanic below preserves it. A member always comes
back up exactly `n` weeks later.

- tasks > members → someone doubles up that week (**accepted**).
- tasks < members → some members idle that week.
- Skips can transiently land two tasks on the same member (**collision accepted**,
  self-corrects the next week). No cross-task de-collision logic.

## Config (on the `wg` singleton)

- `rotation`: `uuid[]` — ordered member ids. Separate from join order, editable
  (reorder who follows whom).
- `graceDays`: `int`, default `2` — length of the post-deadline grace window.

New member → **appended** to `rotation`. Archived member → **removed**;
all open turns get their indices **repaired** (see below).

## Tasks

Editable list (add / rename / remove / reorder), replacing today's `chores`
rows. A task has a `name` and a starting **offset**. Task count is variable and
does not affect the math — each task is an independent turn-chain coupled to the
others only by its initial offset.

On create: first turn `dueAt` = **this coming Sunday** (`endOfThisWeek`,
Europe/Berlin). First assignee is explicit, defaulting to an auto-staggered
member (task 1 → roster[0], task 2 → roster[1], …); creator may override.

## Turns (materialized, one open turn per task)

The nominal schedule is truth; the open turn is the earliest unresolved week.

| field | meaning |
| --- | --- |
| `rotationIndex` | nominal position in `rotation`. **Immutable** under swap/away — drives the next advance. |
| `assigneeId` | nominal member = `roster[rotationIndex]`. |
| `executorId` | *new*, nullable, defaults to `assigneeId`. Who actually does/did it (set on away-override or swap). |
| `dueAt` | always a **Sunday 23:59:59 Berlin**. |
| `completedAt` / `skippedAt` | resolution. |
| `graceNotifiedAt` | *renamed from* `overdueNotifiedAt`. Dedup for the grace warning. |

`done` / push / display target `executorId ?? assigneeId`. Advance always
computes from `rotationIndex`.

## Resolving the open turn (member clicks **done**)

Grace cutoff = `dueAt + graceDays` (default Tuesday 23:59).

- **On time / within grace** (`now ≤ cutoff`): advance **+1**. Next open turn =
  next nominal member, `dueAt = prevDue + 7d`.
- **Past grace** (`now > cutoff`): the **next member is skipped** — the late
  executor's single clean is deemed to cover that member's week too. Advance
  **+1 per full week past grace** beyond the base step. Next open turn = the
  member after the skipped span, `dueAt = prevDue + steps · 7d`.

```
steps = 1 + (number of grace cutoffs already passed at completion time)
      # cutoffs sit at prevDue + graceDays + k·7d, k = 0,1,2,…
nextIndex = (prevIndex + steps) % n
nextDue   = prevDue + steps · 7d       # always a Sunday, never derived from now
```

Deadlines are **always derived from the previous deadline**, never from when
someone actually clicks done. Early or on-time completion keeps the weekly
Sunday cadence intact.

**Skipped span → one summary row.** When `steps > 1`, materialize a **single**
skipped turn row (`skippedAt` set) summarizing the covered span (names the
skipped member(s)), then open the next real turn. Not one row per skipped week.

## Away (`awayUntil`)

Evaluated when a turn starts. If the nominal member is away:

- the **away member is skipped** — their turn row gets `skippedAt` set,
- `executorId` is overridden to the **next present neighbor**, who does it,
- `rotationIndex` / nominal sequence untouched (advance +1 as normal).

If everyone is away, assign the next index anyway (today's fallback).

### The two skips, side by side

| | who is skipped | who executes | index effect |
| --- | --- | --- | --- |
| **Past-grace late** | next member | the late member | +1 per extra late week |
| **Away** | the away (nominal) member | next present neighbor | none (+1 normal) |

Both preserve the calendar-locked `roster` sequence — no permanent drift.

## Push (chores only — invariant unchanged)

- **New-turn** "Du bist dran" push on advance — kept.
- **One grace warning**, fires **Monday** (first hourly worker run after the
  Sunday deadline, while `dueAt < now < cutoff`), deduped via `graceNotifiedAt`.
  Message ~ "Überfällig — bis Dienstag erledigen, sonst wird übersprungen." Only
  fires inside the window; if grace already expired unwarned, skip it.
- **Dropped:** the old `due + 24h` overdue push and any skip/penalty notify.

Worker stays the hourly cron; only the predicate + message change.

## Endpoints

- `POST /:id/done` — resolve open turn (on-time / grace / penalty logic above).
- `PATCH /:id/turn/assignee` (**swap**) — sets `executorId`; leaves
  `assigneeId` / `rotationIndex` (nominal truth) unchanged.
- `POST /:id/remind` — manual nudge push. Kept.
- `POST /:id/skip` — **removed** (away is auto-handled; no manual skip).
- `POST /` `PATCH /:id` `DELETE /:id` — task CRUD. PATCH to rotation/roster must
  **repair every open turn's index** across all tasks (today's code repairs one).

Any member may click done (trust model, unchanged).

## Activity (sole audit trail — minimal vocab)

Every mutation writes its change + `logActivity` in one transaction.

- `chore.done` — payload flags `late` / `pastGrace` + `executorId` in snapshot.
- `chore.skipped` — penalty skip; payload names the skipped member(s).
- `chore.covered` — **new kind**; away-override or swap (executor ≠ assignee).
- `chore.created` / `chore.updated` / `chore.deleted` / `chore.reminded` — as today.

## Display

The `chores` / *Putzplan* display function reads the new open turns (task → who's
up). Shape is compatible; only a minor render tweak.

## Schema delta (summary)

- `wg`: **add** `rotation uuid[]`, `graceDays int default 2`.
- `chores` (tasks): **drop** `frequency`, `intervalDays`, `rotation`. Keep `name`,
  add `offset` (starting position).
- `chore_turns`: **add** `executorId uuid null`; **rename** `overdueNotifiedAt`
  → `graceNotifiedAt`. Keep `rotationIndex`, `assigneeId`, `dueAt`,
  `completedAt`, `skippedAt`.
- `shared`: update `chore.ts` schemas; add `chore.covered` to `ACTIVITY_KINDS`.
- `api/src/lib/time.ts`: replace `choreDueDate` / `intervalDaysFor` with the
  Sunday-cadence + grace-step helpers.
