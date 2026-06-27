# WG App — Target Technical Architecture

> Technical companion to `TARGET_FUNCTIONALITY.md`. Defines **how** the app is built, hosted, and distributed.
> Stack theme: a **self-hosted PWA** — React web app installed to home screen, talking to a Node API on a home Raspberry Pi.

## 0. Stack at a glance

| Layer | Choice |
|-------|--------|
| Client | **React web PWA** (installed via manifest / Add-to-Home-Screen) |
| Client tooling | **Vite + React + `vite-plugin-pwa`** (Workbox service worker) |
| UI | **MUI (Material UI)** + Emotion styling — no Tailwind |
| Data/cache | **TanStack Query** (pull-based, refetch-on-focus) |
| Routing | **React Router** |
| Forms/validation | **React Hook Form + Zod** (schemas shared with API) |
| API | **Node + Fastify, TypeScript** |
| DB access | **Drizzle ORM** (+ Drizzle migrations) |
| Database | **PostgreSQL** (`postgres:16-alpine` container; data on USB SSD) |
| Push | **Web Push + VAPID** (server-sent), no Expo, no app stores |
| Repo | **pnpm monorepo** — `web/` · `api/` · `shared/` |
| Host | **Raspberry Pi 4 (4 GB)** (dedicated) |
| Orchestration | **Docker Compose** — `db`, `migrate`, `api`, `worker`, `caddy`, `cloudflared` |
| Reverse proxy | **Caddy** container (serves PWA + proxies `/api`) |
| Reachability | **Cloudflare Tunnel** container (token mode, no port-forward, TLS) |
| Secrets | **dotenv** `.env` (compose) + `api/.env` (server); gitignored, never baked into images |
| Backups | nightly `pg_dump` (via `docker compose exec`) → `rclone` → **Cloudflare R2** (host systemd timer) |

---

## 1. Client (PWA)

- **React web PWA**, not native. Chosen so iOS gets push **without** a $99/yr Apple Developer account.
  - iOS Web Push works on **iOS 16.4+** but **only when the PWA is installed to the Home Screen** (not a plain Safari tab). Onboarding must instruct iOS users to "Add to Home Screen".
  - Android (Chrome): Web Push works installed or not.
- **Vite + React + `vite-plugin-pwa`** — builds a static SPA; Workbox generates the service worker (installability, app-shell cache, push handling) + manifest.
- **MUI (Material UI)** — batteries-included component set + theming; built-in date/time pickers (used for meetings & chore scheduling). Single styling system via `sx`/`styled` (Emotion). Bigger bundle than utility CSS, but cached after first install.
- **TanStack Query** — caching, **refetch-on-window-focus**, pull-to-refresh, mutation invalidation. Implements the pull-based freshness model (no WebSockets).
- **React Router** — SPA routing.
- **React Hook Form + Zod** — typed forms; Zod schemas imported from `shared/` so client and server validate identically.

### Offline scope
- **App shell only.** Service worker caches the UI → app launches offline (no white screen) and shows last-fetched data (via Query cache).
- **Mutations require network.** No offline write queue, no IndexedDB sync → no conflict resolution. (Deferred; not needed for WG usage.)

---

## 2. API

- **Node + Fastify + TypeScript.** Lightweight, fast on Pi, shares types with the client.
- Houses the real business logic:
  - **Debt-netting / simplification** algorithm (computed server-side on request).
  - **Chore rotation** advancement (advance-on-completion, swap/skip).
  - **Invite-token** issue/validate/burn.
  - **Push dispatch** (Web Push send).
- **Drizzle ORM** for typed queries + schema migrations.
- **Data freshness: pull-based.** No realtime layer. Clients refetch on focus / pull-to-refresh.
- **Balances: computed on read** — `SUM(expense_shares) − settlements`; nothing materialized, so no drift when expenses are edited/deleted.

### Cron worker
- A scheduled worker (the separate `worker` container running node-cron) for **time-based push**:
  - Chore **overdue** check (push once, 1 day after due).
  - Meeting **reminder** (fixed 1h before each occurrence).
- Event-driven push (chore turn started, new meeting/poll) fires inline from the relevant API mutation.

---

## 3. Auth & identity (loose coupling, trust-based)

Deliberately loose: **joining the WG** is separate from **being a member**.

- **Invite link = join the WG** (not a specific member). Carries an **expiring (24h), reusable** invite token (opaque random, DB-backed; not single-use).
- On join, the device stores a **WG access token** (shared secret — proves "in this WG", not *who you are*). The token is the WG secret verbatim; the redeem response hands it back.
- **API auth = WG token only.** Validates membership in the WG, nothing more.
- **Identity = local choice.** Device picks "who am I" from the member list; **switchable anytime**, **trust-based**, sent as an **unverified member-id** alongside requests.
- **Impersonation is possible by design** (flat trust model). The only real secret is the WG token; a leaked invite link = outsider access → hence invite links **expire after 24h** (reusable within that window).
- **No passwords, no per-member secret, no account recovery flow.**

### Push registration (ties identity → device)
- Each device registers its **Web Push subscription** + its **current member-id** with the API.
- When a user switches identity, the mapping updates.
- Targeted push (e.g. "your chore turn") = look up subscriptions currently claiming that member-id.

---

## 4. Data model (PostgreSQL)

Conventions:
- **UUID primary keys** (server-generated).
- **Soft-remove:** `members.archived_at` (null = active). Archived members drop out of active lists but remain in the ledger/history.
- **Append-only `activity`** table: one row per mutating action → powers the activity feed (decoupled from source tables). **Doubles as the audit trail** — `*.updated` rows carry full `{ before, after }` snapshots; there is no separate audit table.
- **Hard delete** for expenses + settlements (computed-on-read balances → no drift; the feed snapshot preserves history).

Core tables (indicative):
- `wg` — the single household (name, settings, WG secret).
- `members` — id, display name, `archived_at`, `away_until` (auto-skip in chore rotations).
- `devices` — push subscription (`push_endpoint` unique / keys), current `member_id`.
- `invites` — token (opaque random, 24h expiry, reusable), created_by.
- `expenses` — payer, total, description, category.
- `expense_shares` — per-participant split in cents (resolved from equal / exact / shares / percent at write time).
- `settlements` — payer, payee, amount (partial allowed; no confirmation step; editable + hard-deletable).
- `fixed_costs` — **Financial Overview** board (name, amount, cycle, contract-holder). Always split equally among active members; per-person share computed on read. **Standalone, not linked to the ledger.**
- `shopping_items` — name only; `bought_at` moves items to history.
- `chores` — frequency, rotation order.
- `chore_turns` — assignee, `rotation_index`, due date, `completed_at`, `skipped_at`, `overdue_notified_at`.
- `meetings` — fixed / recurring / poll; `last_reminder_at` (reminder dedup; fixed 1h lead).
- `meeting_options` + `meeting_votes` — poll mode.
- `meeting_rsvps` — yes / no per member.
- `activity` — append-only feed.

---

## 5. Push notifications (Web Push)

- **Transport: Web Push protocol + VAPID keypair** (generated once; private key in `api/.env`, public key baked into the web build). No Expo Push Service, no APNs/FCM certs to manage directly.
- **Server (Pi) sends** all pushes; the **service worker** on each device receives and displays them.
- Triggers (per functional spec — chores + meetings only):

| Trigger | Source |
|---------|--------|
| Chore turn started | event-driven (someone marked previous turn done) |
| New meeting / poll invite | event-driven |
| Chore overdue (once, 1 day after due) | cron worker |
| Meeting reminder (1h before) | cron worker |

- **No push** for money or shopping events (feed only).
- Caveat: push only fires while the **Pi is up** (home-server downtime = missed reminders — accepted).

---

## 6. Hosting & infrastructure

### Hardware
- **Raspberry Pi 4 Model B**, dedicated to the WG app (no Jellyfin/Home Assistant after all → lean single-purpose setup).

### OS / storage (SD-wear mitigations)
- **Raspberry Pi OS Lite** (no desktop).
- **PostgreSQL data directory on a USB stick/SSD** (boot stays on SD) for write-endurance — bind-mounted into the `db` container at `/mnt/data/pgdata`.
- **Reduce Postgres logging** (`log_statement=none`) and trim WAL settings to limit flash writes — passed as `command:` flags to the `db` container.
- SD/flash is treated as disposable → backups mandatory (§8).

### Orchestration — Docker Compose
- The whole stack runs as containers; no host-level Node/Postgres/Caddy installs (only Docker itself + one host systemd timer for backups).
- Services: **`db`** (postgres), **`migrate`** (one-shot `drizzle-kit migrate`, runs before api/worker), **`api`** (Fastify), **`worker`** (cron; same image as api, different entrypoint), **`caddy`** (PWA + proxy), **`cloudflared`** (tunnel).
- `restart: unless-stopped` gives auto-start on boot + auto-restart on crash; logs via `docker compose logs`.
- **Images are arm64** — build on the Pi or cross-build with `buildx --platform linux/arm64`.
- **api + worker share one image** (the root `Dockerfile`, multi-stage `build`/`runtime`); the `migrate` service reuses the `build` stage (it has `drizzle-kit`).
- (Earlier the spec favored systemd for leanness; switched to Docker Compose to collapse the manual install steps. On a 4 GB Pi the whole stack idles ~0.5–0.7 GB.)

### Reverse proxy — Caddy (container)
- Serves the **static PWA build** (baked into the Caddy image at `/srv`) and reverse-proxies `/api/*` → `api:3000` over the compose network. See `web/Caddyfile`.
- TLS: Cloudflare Tunnel terminates public TLS; Caddy serves plain HTTP on `:80` behind it.

### Reachability — Cloudflare Tunnel (container)
- `cloudflared` runs in token mode; the public hostname points at `http://caddy:80` (configured in the Cloudflare dashboard).
- **No port-forwarding, no exposed home IP, no dynamic DNS.** Survives ISP IP changes.

---

## 7. Repository structure

**pnpm monorepo:**
```
wg-app/
├─ web/      # Vite + React PWA
├─ api/      # Fastify + Drizzle
└─ shared/   # Zod schemas + TS types (imported by web & api)
```
- Single source of truth for validation/types across client + server.

---

## 8. Secrets & backups

### Secrets — dotenv
- `.env` files, **gitignored**; `.env.example` committed to document required vars.
- Server secrets in `api/.env`: Postgres creds, WG join secret (the shared bearer token), **VAPID private key**, Cloudflare Tunnel token. (No invite-signing secret — invite tokens are opaque random rows.)
- Web build gets only **public** values (Vite `VITE_*`): API URL, **VAPID public key**.

### Backups — mandatory (SD/USB will fail)
- **Nightly `pg_dump | gzip`** via systemd timer.
- Shipped **offsite** with `rclone` → **Cloudflare R2**.
- Retention: ~14 daily + a few monthly (data is MB-scale).

---

## 9. Distribution

- **No app stores, no Apple Developer account, no TestFlight.**
- Users open the URL → **Add to Home Screen** → installed PWA with push.
- iOS users: must install to Home Screen (iOS 16.4+) for push to work — include a short install guide in onboarding.

---

## 10. Notable deferrals / non-goals
- Native app (Expo/React Native) — dropped in favor of PWA (cost + distribution).
- WebSockets / realtime — pull-based only for v1.
- Offline writes / sync queue — app-shell offline only.
- Materialized balances — computed on read.
- Kubernetes / multi-host orchestration — single-Pi Docker Compose is enough.
- Multi-device-per-member secrets / account recovery — N/A under trust-based loose identity.
