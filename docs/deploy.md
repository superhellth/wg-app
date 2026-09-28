# WG App — Deployment Guide (Docker)

Deploy the WG app onto a **VPS** with **Docker Compose**, exposed via
**Cloudflare Tunnel**, with **PostgreSQL data on the VPS disk** and offsite
backups streamed to **Cloudflare R2**.

Everything runs as containers — no host-level Node/Postgres/Caddy installs.

```
            Internet (HTTPS)
                  │
          Cloudflare Tunnel            (no open inbound ports needed)
                  │
   ┌──────────────┴───────────────┐  VPS — docker compose
   │  cloudflared → caddy:80       │  caddy: static PWA + /api proxy
   │  caddy /api/* → api:3000      │  api:   Fastify
   │  worker (cron)                │  worker: time-based push
   │  backup (cron → R2)           │  backup: nightly pg_dump → R2 (stream)
   │  api/worker → db:5432         │  db:    postgres (data on VPS disk)
   └───────────────────────────────┘
```

Compose services: `db`, `migrate` (one-shot), `api`, `worker`, `backup`, `caddy`, `cloudflared`.

---

## 0. Prerequisites

- A VPS (Linux, 1–2 GB RAM is plenty) with SSH access. Images are built for the
  VPS's CPU architecture (usually **amd64**; arm64 VPSs work too).
- A Cloudflare account + a domain on Cloudflare, and an R2 bucket (backups).

---

## 1. Prepare the VPS

### 1.1 Update + firewall
```bash
ssh youruser@<vps-ip>
sudo apt update && sudo apt full-upgrade -y && sudo reboot
```
The tunnel is outbound-only, so no inbound ports besides SSH are required. Port 80
is published by the `caddy` service for debugging — restrict it with the host
firewall (or drop the `ports:` mapping in `docker-compose.yml`).

### 1.2 Create the Postgres data dir
The `db` container bind-mounts `/mnt/data/pgdata`; create it once:
```bash
sudo mkdir -p /mnt/data/pgdata
```

### 1.3 Install Docker
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"      # log out/in so docker runs without sudo
docker --version && docker compose version
```

---

## 2. Get the app + configure secrets

```bash
sudo mkdir -p /opt/wg-app && sudo chown "$USER":"$USER" /opt/wg-app
git clone <your-repo-url> /opt/wg-app
cd /opt/wg-app
```

Generate the VAPID keypair once (any machine with Node):
```bash
npx web-push generate-vapid-keys
```

Create the two env files from the example:
```bash
cp .env.example .env          # compose-level vars
cp .env.example api/.env      # server secrets (same template; fill the api/ section)
nano .env ; nano api/.env
```

- **`.env` (repo root)** — `POSTGRES_PASSWORD`, `VITE_API_URL`
  (`https://wg.yourdomain.com`), `VITE_VAPID_PUBLIC_KEY`, `TUNNEL_TOKEN`.
- **`api/.env`** — `WG_TOKEN_SECRET` (`openssl rand -base64 48`), `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. `DATABASE_URL` is injected by compose — leave
  it unset here.

> Secrets are gitignored and never copied into images (see `.dockerignore`).

---

## 3. Generate migrations (once, on your dev machine)

Drizzle migrations are committed to the repo; the `migrate` container only applies
them. Before the first deploy (and after any `schema.ts` change):
```bash
pnpm db:generate        # writes api/drizzle/*.sql + snapshot
git add api/drizzle && git commit -m "db: migration"
```
Pull the repo on the VPS so `api/drizzle/` is present.

---

## 4. Build + run

```bash
cd /opt/wg-app
docker compose build
docker compose up -d
```

The `migrate` service runs and exits before `api`/`worker` start (compose waits on
`service_completed_successfully`). Check:
```bash
docker compose ps
docker compose logs -f api
curl http://127.0.0.1/api/health      # → {"ok":true} via Caddy
```

---

## 5. Expose via Cloudflare Tunnel (token mode)

1. Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel**
   (Cloudflared). Copy the **tunnel token** into `.env` as `TUNNEL_TOKEN`.
2. Add a **public hostname**: `wg.yourdomain.com` → service `http://caddy:80`.
3. Bring the stack up (the `cloudflared` container connects outbound):
   ```bash
   docker compose up -d cloudflared
   docker compose logs -f cloudflared
   ```
Visit `https://wg.yourdomain.com` — the PWA loads and `/api/health` responds.

---

## 6. Backups → Cloudflare R2

Backups run as a **dockerized `backup` service** (`backup/` in the repo) — no host
`rclone` install, no `rclone config`, no systemd. The container sleeps until
`BACKUP_HOUR:BACKUP_MINUTE` (default 03:30 Europe/Berlin) and **streams `pg_dump`
straight to R2** (`rclone rcat`) — nothing is written to the VPS disk. The R2
remote is built from `RCLONE_CONFIG_R2_*` env vars, so it's fully declarative.
R2 is the only off-box copy; prune old dumps with an **R2 bucket lifecycle rule**.

### 6.1 Configure R2
1. Cloudflare → **R2** → create a bucket (e.g. `wg-backups`).
2. **R2 → Manage API Tokens** → create a token with **Object Read & Write**.
3. Fill the backup vars in **`.env`** (repo root):
   ```bash
   R2_BUCKET=wg-backups
   R2_ACCESS_KEY_ID=<token access key id>
   R2_SECRET_ACCESS_KEY=<token secret>
   R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   ```
   The endpoint is on the bucket's **Settings → S3 API** page.

### 6.2 Run it
It comes up with the rest of the stack:
```bash
docker compose up -d backup
docker compose logs -f backup            # shows "next run in …s"
```
Tune the schedule via the service's env in `docker-compose.yml`
(`BACKUP_HOUR`, `BACKUP_MINUTE`). To take a backup immediately
(e.g. to verify R2 works):
```bash
docker compose run --rm -e BACKUP_ON_START=true backup
```

**Restore** (pull from R2 and pipe straight into the db):
```bash
# list available dumps in the bucket
docker compose exec backup rclone ls r2:wg-backups

# stream a chosen dump from R2 into postgres
docker compose exec -T backup sh -c 'rclone cat r2:wg-backups/wg-YYYYMMDD-HHMMSS.sql.gz | gunzip' \
  | docker compose exec -T db psql -U wg -d wg
```

---

## 7. Install the app on phones

No app stores. Each roommate opens `https://wg.yourdomain.com`:
- **Android (Chrome):** menu → **Add to Home screen**, allow notifications.
- **iOS (Safari, 16.4+):** Share → **Add to Home Screen**, open from the home
  screen, allow notifications. (Push works only from the installed PWA, not a tab.)

First member creates the WG and adds the roster; everyone else joins via the
**invite link** (expires after 24h, reusable within that window) and picks their
name from the roster.

---

## 8. Updating the app

```bash
cd /opt/wg-app
git pull
docker compose up -d --build   # rebuilds + recreates changed services; migrate runs first
docker image prune -f          # free space
```
No `docker compose down` needed. The PWA auto-updates on clients (Workbox
`autoUpdate`) on next load.

---

### Automated deploys (GitHub Actions)
`.github/workflows/deploy.yml` runs typecheck + build on every push/PR and, on `main`,
SSHes into the VPS and runs the update above. One-time setup:
1. `ssh-keygen -t ed25519 -f deploy_key -N ""`; append `deploy_key.pub` to the VPS
   user's `~/.ssh/authorized_keys`.
2. Give the VPS read access to the repo (read-only GitHub deploy key) so `git pull` works.
3. Repo → Settings → Secrets → Actions: `DEPLOY_SSH_KEY` (private key), `VPS_HOST`, `VPS_USER`.
Secrets (`.env`, `api/.env`) stay on the VPS only.

---

## 9. Health checklist

| Check | Command |
|-------|---------|
| Containers up | `docker compose ps` |
| DB healthy | `docker compose exec db pg_isready -U wg` |
| DB data dir | `ls /mnt/data/pgdata` (non-empty) |
| API + proxy | `curl http://127.0.0.1/api/health` |
| Public reachable | open `https://wg.yourdomain.com` |
| Tunnel up | `docker compose logs cloudflared` |
| Backups | `docker compose logs backup` (shows next run); `docker compose exec backup rclone ls r2:wg-backups` |
| Logs | `docker compose logs -f api worker` |

---

## 10. Notes & gotchas

- **Architecture.** Images must match the VPS CPU (amd64 or arm64). Build on the
  VPS, or cross-build with `buildx --platform <arch>` if building elsewhere.
- **Postgres data lives on the VPS disk** (`/mnt/data/pgdata` bind mount). **R2 is
  the only off-box copy**, so the nightly backup is the real safety net: to rebuild,
  reinstall Docker, `git clone`, `mkdir /mnt/data/pgdata`, `compose up`, then restore
  the latest dump from R2 (§6.2). Consider provider snapshots as a second layer.
- **Migrations must be committed** before deploy (`pnpm db:generate`). The `migrate`
  container fails fast if `api/drizzle/` is empty.
- **VAPID keys are permanent.** Regenerating invalidates all push subscriptions.
- **Push needs the VPS online.** Provider outage = missed reminders (accepted per spec).
- **Memory:** the whole stack idles around ~0.5–0.7 GB.
