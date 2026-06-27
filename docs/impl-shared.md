# Implementation — `shared/` (`@wg/shared`)

> Locked implementation decisions for the shared package. Companion to `impl-api.md`.
> `shared` is the single source of truth for validation, types, enums, and pure
> domain math used identically by `web/` and `api/`.

## Conventions

- **One file per domain** in `shared/src/`, re-exported from `index.ts`.
- Each domain file exports:
  - `createXSchema` — POST body
  - `updateXSchema` — PATCH body (usually `= createXSchema`, or a partial)
  - `xSchema` — the full persisted entity (`id`, `createdAt`, server-set fields)
  - `type X = z.infer<typeof xSchema>` (and inferred types for the others)
- Shared route-param schemas live in `common.ts` (`idParamSchema = { id: uuid }`).
- **Money:** integer **cents** everywhere (`cents` in `common.ts`). EUR only.
- **Dates on the wire:** ISO-8601 with offset (`isoDate`). Drizzle returns JS
  `Date`; Fastify's `JSON.stringify` serializes it to ISO, matching the
  `z.string().datetime({ offset: true })` fields. Client parses with dayjs.
- **No money/date drift:** never send floats for money, never send `Date` objects.

## Enums — single source of truth (`enums.ts`)

Each enum is declared **once** as a `const` value array and consumed by both Zod
(here) and Drizzle (`api/src/db/schema.ts` imports the arrays via `@wg/shared`).
This makes enum drift between DB and validation impossible.

```ts
export const SPLIT_TYPES = ["equal","exact","shares","percent"] as const;
export const splitType = z.enum(SPLIT_TYPES);
```

Arrays: `SPLIT_TYPES`, `CHORE_FREQUENCIES`, `MEETING_MODES`, `RSVP_VALUES`,
`BILLING_CYCLES`.

## Cross-cutting types

- **`auth.ts`** — `AuthContext { wgToken; memberId | null }`; header name consts
  `AUTH_HEADER` (`authorization`), `MEMBER_HEADER` (`x-member-id`). See `impl-api.md` §auth.
- **`push.ts`** — `PushPayload { title; body; url?; tag? }`. Shared by the server
  dispatcher and the service-worker renderer.
- **`activity.ts`** — `ACTIVITY_KINDS` vocab (dotted strings, e.g. `expense.updated`),
  `activitySchema`, and `activityQuerySchema` (cursor: `before` + `limit`, max 100).
  The feed is the **sole audit trail** — `*.updated` carries `{ before, after }`
  full-row snapshots; `*.created`/`*.deleted` carry `{ snapshot }`.
- **`settlement.ts`** — also exports `suggestedTransferSchema` / `SuggestedTransfer`
  (output of the netting algorithm, consumed client-side).

## Money — split resolution (`expense.ts`)

`resolveShares(amount, splitType, shares) → { memberId, amount }[]` is **pure** and
lives in `shared` so the client previews splits and the server persists
`expense_shares` with **identical** results.

- Interpretation of `ExpenseShare.value` by `splitType`: `equal` (ignored),
  `exact` (cents owed), `shares` (count), `percent` (points, sum 100).
- **Rounding (equal/shares/percent):** largest-remainder — floor each share, then
  hand leftover cents one-by-one to the largest fractional remainders (ties broken
  by input order). `Σ shares === amount` **always**.
- `exact`: no rounding; validated to sum to `amount`.
- **Per-type validation via `superRefine`** on `createExpenseSchema` (client + server
  reject identically): duplicate member ids rejected; `exact` sums to `amount`;
  `percent` sums to 100; `shares` are positive integers.

## Domain notes

- **expense:** no `recurring` field (feature dropped). `createExpenseSchema` carries
  optional `shoppingItemIds` for the shopping→expense bridge (server marks them
  bought atomically — see `impl-api.md`).
- **member:** `awayUntil` (nullable) drives chore auto-skip. `updateMemberSchema`
  edits `displayName`/`awayUntil`. `memberQuerySchema` has `includeArchived`.
- **chore:** `createChoreSchema` has optional `firstAssigneeId` (must be in
  `rotation`; defaults to `rotation[0]`). `choreTurnSchema` carries `rotationIndex`
  (authoritative position; swap changes assignee, not index), `skippedAt`,
  `overdueNotifiedAt`. `swapTurnSchema = { assigneeId }`.
- **meeting:** no configurable lead time — `REMINDER_LEAD_MINUTES = 60` constant
  (invite at creation + reminder 1h before). `superRefine`: poll needs ≥2 options,
  fixed/recurring need `startsAt`, recurring needs `recurEveryDays`.
  `resolvePollSchema = { optionId }`, `voteSchema = { optionId }` (approval voting),
  `rsvpSchema = { value }`.
- **fixedCost:** no `splitAmong` — always equal among active members.
  `fixedCostViewSchema` adds the read-time computed `perPersonShare` (cents).
- **settlement:** `updateSettlementSchema` (editable; hard delete also allowed;
  changes logged to activity).
