# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Self-hosted **PWA** for managing a single shared-living household (German *Wohngemeinschaft*). One WG, flat permissions (no admin), EUR only, German UI. Trust-based loose identity: no passwords. Designed to run on a home Raspberry Pi behind Caddy + Cloudflare Tunnel.

Design docs are the source of truth — read them before non-trivial work:
- `TARGET_FUNCTIONALITY.md` — **what** the app does (membership, money split, fixed-cost board, shopping, chores, meetings, activity feed, push matrix).
- `target_technical.md` — **how** it's built/hosted (stack, data model, auth model, hosting).
- `docs/impl-shared.md` + `docs/impl-api.md` — **locked implementation decisions** for the `shared` and `api` packages (auth headers, onboarding, error envelope, split math, balances, chores/meetings mechanics, cron). The most specific source for building out routes.
- `DEPLOY.md` — Pi deployment (systemd, Caddy, Cloudflare Tunnel, backups).

> Current state: early scaffold. Schema + shared Zod types are mostly complete, but only the `members` route is implemented. `api/src/routes/index.ts` lists the remaining domains as TODO, and no Drizzle migrations have been generated yet.

## Commands

Run from repo root (pnpm 10 workspace, Node ≥20):

```bash
pnpm dev          # run all three packages in parallel (shared tsc --watch, api tsx watch, web vite)
pnpm dev:web      # web only
pnpm dev:api      # api only
pnpm build        # build all packages (-r)
pnpm typecheck    # tsc --noEmit across all packages
pnpm db:generate  # drizzle-kit generate (create migration from schema)
pnpm db:migrate   # drizzle-kit migrate (apply migrations)
```

API-only extras (run in `api/`): `pnpm db:studio` (Drizzle Studio), `pnpm start` (run built `dist/index.js`).

No test runner is configured yet.

### Local prerequisites
- Postgres reachable at `DATABASE_URL`. Copy `.env.example` → `api/.env` (server secrets) and a web `.env` (only `VITE_*` vars are exposed to the client).
- After editing `api/src/db/schema.ts`, run `pnpm db:generate` then `pnpm db:migrate`.
- `shared` must be built (or running in watch via `pnpm dev`) for `api`/`web` to resolve `@wg/shared` — it's imported through `dist/`.

## Architecture

pnpm monorepo, three packages (`pnpm-workspace.yaml`):

- **`shared/`** (`@wg/shared`) — Zod schemas + inferred TS types, one file per domain (`expense.ts`, `chore.ts`, …) re-exported from `src/index.ts`. **Single source of validation truth**: both API (runtime `safeParse` in routes) and web (React Hook Form resolvers) import the same schemas. `common.ts` holds shared primitives — notably **all money is integer cents** (`cents`), EUR only.
- **`api/`** (`@wg/api`) — Fastify + TypeScript. `src/index.ts` bootstraps; `src/routes/index.ts` registers domain routers under `/api/*`. DB via Drizzle (`src/db/schema.ts` is the full data model; `src/db/client.ts` exports `db` + `schema`). Env is validated through Zod in `src/env.ts` — add new config there. Business logic lives in `src/services/` (e.g. `netting.ts`).
- **`web/`** (`@wg/web`) — Vite + React 18 + MUI (Emotion, no Tailwind). TanStack Query for server state (pull-based, `refetchOnWindowFocus`, no realtime). React Router. `src/api.ts` is the typed fetch wrapper. `vite-plugin-pwa` provides the installable PWA (app-shell cache only today; custom service worker for Web Push is planned via `injectManifest`).

### Key invariants (from the design docs)

- **Balances are computed on read** — `paid − owes + settlementsOut − settlementsIn`, all cents. Nothing materialized, so editing/deleting an expense or settlement can't cause drift. Don't add a cached balance column.
- **Debt simplification** (`api/src/services/netting.ts`) is greedy largest-creditor/largest-debtor matching over net balances, all in cents. Split→cents resolution is `resolveShares` in `shared` (largest-remainder), used by client preview + server write.
- **Mixed delete policy:** soft-remove `members.archivedAt` (debts persist) and `shopping_items.boughtAt` (history); **hard-delete** expenses + settlements. Don't add `deletedAt` to money tables.
- **`activity` is append-only AND the sole audit trail** (there is no `expense_audit` table). Every mutating route writes the change + a `logActivity` row in **one transaction**; `*.updated` carries full `{ before, after }` snapshots, `kind` from the `ACTIVITY_KINDS` vocab in `shared`.
- **Auth model (trust-based)**: a single WG token (= `WG_TOKEN_SECRET` verbatim, `Authorization: Bearer`) proves membership; `X-Member-Id` is an *unverified* local choice — impersonation is possible by design. Invite tokens are opaque, 24h, **reusable** (not single-use). Don't build per-member secrets or password/recovery flows.
- **Chore rotation advances on completion** — the next turn (`chore_turns`, tracked by `rotationIndex`) is created only when the current is done/skipped; due dates are calendar-boundary (`endOfWeek + interval`, Europe/Berlin); `members.awayUntil` auto-skips.
- **Push is chores + meetings only** (event-driven inline from mutations, plus a cron worker for overdue/reminder). **No push for money or shopping** — those are feed-only.

### Adding a new domain route (the common task right now)

1. Define/extend the Zod schema in `shared/src/<domain>.ts` and export it from `shared/src/index.ts`.
2. Confirm/extend the table in `api/src/db/schema.ts`; run `pnpm db:generate` + `pnpm db:migrate`.
3. Add `api/src/routes/<domain>.ts` (follow `members.ts`: `safeParse` body → 400 on failure, Drizzle query via `db`/`schema`), and register it in `api/src/routes/index.ts` under the right `/api/*` prefix.
4. Wrap each mutation + its `logActivity` call in one `db.transaction`; fire any push fire-and-forget after commit.
5. Add the typed call to `web/src/api.ts` and wire UI with TanStack Query.
