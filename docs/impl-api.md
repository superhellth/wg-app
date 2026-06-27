# Implementation — `api/` (`@wg/api`)

> Locked implementation decisions for the Fastify + Drizzle API. Companion to
> `impl-shared.md`. Trust-based loose-identity model (see `target_technical.md` §3).

## Auth & identity

Two headers on every `/api/*` request (except `POST /api/wg`, invite redeem, and
`/health`), validated by **one `preHandler` hook**:

- `Authorization: Bearer <wgToken>` — compared **constant-time** against
  `env.WG_TOKEN_SECRET`. The token every device holds **is** that secret verbatim
  (one shared bearer string for the whole WG). Wrong/missing → `401 unauthorized`.
- `X-Member-Id: <uuid>` — the device's **unverified** current identity. The hook
  looks it up and attaches `req.member` (or null). Routes needing an actor (most
  mutations, for `activity.memberId`) require it → `400` if absent/archived.

Identity is a pure **local choice**: there is **no server-side claim state**.
Multiple devices may use the same member; switching identity = the device sends a
different `X-Member-Id` (and re-registers its push device). Impersonation is
possible by design; the only real secret is the WG token.

## Onboarding

- **First run — `POST /api/wg`** (no auth; allowed only when the `wg` table is
  empty, else `409 conflict`). Body `{ name }`. Creates the single `wg` row,
  returns `{ wg, wgToken }`. The creator then adds members via `POST /api/members`.
- **Members** are created independently (`POST /api/members`, any authed member).
  Roster flow: create WG → add everyone's names → generate invite → others redeem
  → each device picks its member locally from `GET /api/members`.
- **Invites:** opaque random token (`crypto.randomBytes(32)` base64url), DB-backed,
  `expiresAt = now + 24h`, **reusable until expiry** (NOT single-use — one link, the
  whole WG joins within a day). No `usedAt`, no `INVITE_SECRET`.
  - `POST /api/invites` (authed) → `{ token, expiresAt }`.
  - `POST /api/invites/:token/redeem` (no auth — the valid invite *is* the
    credential) → validates exists + unexpired (`410 gone` if expired/unknown),
    returns `{ wgToken }`. Does **not** create a member.

## Response & error envelope

- **Success: bare payloads** (no `{ data }` wrapper). `201` create, `200` read/update,
  `204` delete.
- **Error: always** `{ error: { code, message, details? } }`, produced by a single
  Fastify `setErrorHandler` (not hand-rolled per route).
  - `code` ∈ `validation | unauthorized | not_found | conflict | gone | ...`
  - `details` only for `validation` (the Zod `flatten()` output).
- `web/src/api.ts` `http()` parses this error body and throws `error.message`.

## Validation

A tiny **`parse(schema, data)` helper** runs Zod and throws a typed
`ValidationError` (mapped to `400 { error:{ code:"validation", details }}` by the
error handler). Used for **body, params, and query**:

```ts
const body = parse(createExpenseSchema, req.body);
const { id } = parse(idParamSchema, req.params);
```

No `fastify-type-provider-zod` — explicit and dependency-light.

## Transactions & the activity feed

- The `activity` table is **append-only** and the **sole audit trail** (no
  `expense_audit` table). Every mutating route writes the change **and** the
  activity row in **one `db.transaction`** — no change without its log, no log
  without its change.
- **`logActivity(tx, { memberId, kind, data })`** helper; `kind` from the
  `ACTIVITY_KINDS` vocab in `@wg/shared`. Snapshots are **full rows**:
  `created`/`deleted` → `{ snapshot }`, `updated` → `{ before, after }`.
- `memberId` = acting `X-Member-Id`, or `null` for cron/system actions.

## Money

- **Hard delete** for expenses and settlements (computed-on-read balances mean no
  drift; the feed snapshot preserves history). No `deletedAt` anywhere in money.
- **Expenses:** on create/update, resolve `expense_shares` via `resolveShares`
  (`@wg/shared`) in the transaction. Optional `shoppingItemIds` → mark those
  shopping items `boughtAt = now` **in the same transaction** (atomic bridge).
- **Settlements:** create/update/delete freely (flat trust). A settlement is a
  *ledger record that a real-world payment happened* — the app moves no money.
- **Balances — `services/balances.ts`, computed on read.** Per member, cents,
  positive = is owed:
  `balance = paid − owes + settlementsOut − settlementsIn`.
  - `GET /api/balances` → `{ balances: Record<memberId, cents>, suggestedTransfers }`.
  - `suggestedTransfers` from `services/netting.ts` (`simplifyDebts`, greedy
    largest-creditor/largest-debtor).
  - **Archived members included** (open debts persist). Suggested transfers are
    advice; recording a settlement is how a real payment updates the ledger.

## Push — `services/push.ts`

- **Register/update — `POST /api/devices`** body `{ pushEndpoint, pushKeys, memberId }`,
  **upsert keyed by `pushEndpoint`** (unique). Identity switch = re-POST same
  endpoint with new `memberId`. **`DELETE /api/devices`** (with endpoint) to remove.
- **Dispatch — `sendPushToMember(memberId, payload)`**: select `devices WHERE
  currentMemberId = memberId`, `web-push` send each. On **404/410** delete that row
  (dead-subscription cleanup). No device = silent no-op.
- **Fire-and-forget, post-commit** — push send happens *after* the DB transaction
  commits and never fails/rolls back the mutation; errors are logged.
- **Triggers:** event-driven (chore turn started, new meeting/poll invite) fire
  **inline** in the API mutation; time-based (overdue, reminder) fire from the cron
  worker. `PushPayload` shape from `@wg/shared`. Money & shopping never push.

## Chores

- **One active turn** per chore (`completedAt IS NULL`) at a time; the next is
  created only when the current closes (done or skip).
- **First turn** on chore creation: `assignee = firstAssigneeId ?? rotation[0]`,
  `rotationIndex` = its index, `dueAt = endOfThisWeek(createdAt) + intervalDays`,
  push "turn started".
- **Due date — calendar boundary.** `dueAt = endOfThisWeek(t) + intervalDays`,
  where `t = completedAt` on advance. "End of this week" = upcoming **Sunday
  23:59:59.999**, week Mon–Sun, **Europe/Berlin** (hardcoded for the single German
  WG). `intervalDays`: weekly→7, biweekly→14, custom→`intervalDays`.
- **Advance (done/skip):** next assignee = walk `(rotationIndex+1) % len`, skipping
  members with `awayUntil > now`; if all away, take the next index anyway (no
  infinite loop). One transaction + push to the new assignee.
- **Swap:** `PATCH` current turn's `assigneeId` (rotation position unchanged),
  log `chore.swapped`.
- **Skip:** set `skippedAt`, advance (member away), log `chore.skipped`.
- **Overdue:** computed (`dueAt < now AND completedAt IS NULL`). Cron sends the push
  **once, 1 day after due** (`now ≥ dueAt + 24h AND overdueNotifiedAt IS NULL`),
  setting `overdueNotifiedAt`.
- **Manual reminder — `POST /api/chores/:id/remind`** (any member): push the current
  assignee on demand, log `chore.reminded`, no rate-limit (trust model).

## Meetings

- **Reminders fixed:** invite push to all on create; reminder push **1h before** the
  event (`REMINDER_LEAD_MINUTES = 60`). No configurable lead time.
- **fixed:** `startsAt` at creation; RSVPs open immediately.
- **recurring:** single row (`startsAt` + `recurEveryDays`); **no per-occurrence
  rows** in v1. RSVPs live on the one row; cron computes each occurrence for
  reminders.
- **poll:** ≥2 `meeting_options`, `startsAt` null. **Approval voting** — one
  `meeting_votes` row per (member, option), members may vote several options.
  **Resolve — `POST /api/meetings/:id/resolve` `{ optionId }`** (manual): sets
  `meetings.startsAt` to that option's time (becomes fixed), log `poll.resolved`.
- **RSVP:** `meeting_rsvps`, one row per member, upsert `yes|no`; attendees = `yes`.
- Push: `meeting.created` / `poll.created` → invite to all; reminders via cron.

## Members

- `POST /api/members` (add), `PATCH /api/members/:id` (edit `displayName`/`awayUntil`),
  `PATCH /api/members/:id/archive` (set `archivedAt`), `PATCH /api/members/:id/restore`
  (clear it — mis-archive undo).
- `GET /api/members` → active only; `?includeArchived=true` for ledger/feed views
  that must render archived names.
- **Soft-remove only** (`archivedAt`) — debts persist, settlement still possible.
- **Archiving auto-skips** the member's open chore turns (advance the rotation) so
  chores don't stall. All mutations log activity.

## Shopping

- `GET /api/shopping` → active (`boughtAt IS NULL`); `?history=true` → bought.
- `POST /api/shopping { name }`; `PATCH /api/shopping/:id/bought`; re-add = POST same
  name. `DELETE /api/shopping/:id` → **hard delete** (typos; distinct from "bought").
- **Bridge is client-driven but settled server-side:** the bridge prefills the
  expense form; on expense create the server marks the passed `shoppingItemIds`
  bought atomically (see Money). The list itself tracks no money.
- Logs `shopping.added` / `shopping.bought` to the feed.

## Fixed costs (Financial Overview)

- CRUD `GET/POST/PATCH/DELETE /api/fixed-costs`, **hard delete**. Standalone — no
  ledger link, no balances.
- **Equal split among active members, computed on read:** `perPersonShare =
  amount / activeMemberCount` (returned via `fixedCostViewSchema`). No stored split
  set. Logs `fixedcost.*`.

## Activity feed read

- `GET /api/activity` → newest first, **cursor pagination** (`?before=<iso>&limit=50`,
  cap 100; cursor on `createdAt` + `id` tiebreak). Read-only.
- Server returns raw `kind` + `data`; the **client renders per `kind`** and joins
  member names client-side from `GET /api/members?includeArchived=true` (cached via
  TanStack Query) — the server does not denormalize names into rows.

## Cron worker — `src/worker.ts`

- **Separate entrypoint / `worker` compose service** (same image as `api`,
  `command: node dist/worker.js`; see `DEPLOY.md`), sharing `db`, `services`, and
  `sendPushToMember`; uses `node-cron`. Dispatch lives in `services/reminders.ts`.
- **Meeting reminder** (~every 5 min): per meeting compute the next occurrence
  (fixed: `startsAt`; recurring: next `startsAt + k·recurEveryDays ≥ now`;
  unresolved poll: skip). If `occurrence − now ≤ 60min` and not yet reminded for
  *that* occurrence (`meetings.lastReminderAt`), push + record.
- **Chore overdue** (hourly): rows with `completedAt IS NULL AND skippedAt IS NULL
  AND now ≥ dueAt + 24h AND overdueNotifiedAt IS NULL` → push assignee, set marker.
- Event-driven pushes stay **inline in the API**, not here.

## Routing layout

Domain routers registered in `src/routes/index.ts` under `/api/<domain>`, each
following `members.ts`: `parse()` the input, query via `db`/`schema`, wrap mutations
+ `logActivity` in a transaction, push post-commit. **All implemented:** public `wg`
+ invite-redeem; protected members, invites, devices, expenses, settlements,
balances, shopping, chores, meetings, fixed-costs, activity. The cron worker
(`src/worker.ts`) dispatches via `services/reminders.ts` (`runMeetingReminders`,
`runChoreOverdue`).
