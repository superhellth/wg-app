# WG App — Deployment Guide (Docker)

Deploy the WG app onto a **Raspberry Pi 4 (4 GB)** with **Docker Compose**,
exposed via **Cloudflare Tunnel**, with **PostgreSQL data on a USB SSD** and
offsite backups to **Cloudflare R2**.

Everything runs as containers — no host-level Node/Postgres/Caddy installs.

```
            Internet (HTTPS)
                  │
          Cloudflare Tunnel            (no port-forwarding)
                  │
   ┌──────────────┴───────────────┐  Raspberry Pi 4 — docker compose
   │  cloudflared → caddy:80       │  caddy: static PWA + /api proxy
   │  caddy /api/* → api:3000      │  api:   Fastify
   │  worker (cron)                │  worker: time-based push
   │  backup (cron → R2)           │  backup: nightly pg_dump → R2
   │  api/worker → db:5432         │  db:    postgres (data on USB SSD)
   └───────────────────────────────┘
```

Compose services: `db`, `migrate` (one-shot), `api`, `worker`, `backup`, `caddy`, `cloudflared`.

---

## 0. Prerequisites

- Raspberry Pi 4 **(4 GB)**, microSD (boot), **USB SSD** (Postgres data + backups).
- A Cloudflare account + a domain on Cloudflare, and an R2 bucket (backups).
- A dev machine with Docker (for cross-building arm64 images) — optional but
  faster than building on the Pi.

---

## 1. Prepare the Raspberry Pi

### 1.1 Flash + update
1. **Raspberry Pi Imager** → **Raspberry Pi OS Lite (64-bit)**; set hostname
   (e.g. `wgpi`), enable SSH, set user/Wi-Fi/locale.
2. SSH in and update:
   ```bash
   ssh youruser@wgpi.local
   sudo apt update && sudo apt full-upgrade -y && sudo reboot
   ```

### 1.2 Mount the USB SSD for Postgres data
```bash
lsblk                         # find the device, e.g. /dev/sda
sudo mkfs.ext4 /dev/sda1      # ⚠️ erases it — pick the right device
sudo mkdir -p /mnt/data
sudo blkid /dev/sda1          # copy UUID=...
echo 'UUID=<your-uuid>  /mnt/data  ext4  defaults,noatime,nofail,x-systemd.device-timeout=10  0  2' | sudo tee -a /etc/fstab
sudo mount -a
sudo mkdir -p /mnt/data/pgdata /mnt/data/backups
```
> `noatime` reduces flash writes. The `db` container bind-mounts `/mnt/data/pgdata`.

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
Pull the repo on the Pi so `api/drizzle/` is present.

---

## 4. Build + run

### Option A — build on the Pi (simplest)
```bash
cd /opt/wg-app
docker compose build
docker compose up -d
```
First build on a Pi 4 takes a few minutes; subsequent builds are cached.

### Option B — cross-build on a dev machine (faster)
```bash
# on dev machine, in the repo
docker buildx build --platform linux/arm64 -t <registry>/wg-api:latest --push .
docker buildx build --platform linux/arm64 -f web/Dockerfile \
  --build-arg VITE_API_URL=https://wg.yourdomain.com \
  --build-arg VITE_VAPID_PUBLIC_KEY=<key> \
  -t <registry>/wg-caddy:latest --push .
```
Then point the compose services at the pushed images and `docker compose up -d` on the Pi.

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
Visit `https://wg.yourdomain.com` — the PWA loads and `/api/health` responds. No
port-forwarding, no exposed home IP.

---

## 6. Backups → Cloudflare R2

Backups run as a **dockerized `backup` service** (`backup/` in the repo) — no host
`rclone` install, no `rclone config`, no systemd. The container sleeps until
`BACKUP_HOUR:BACKUP_MINUTE` (default 03:30 Europe/Berlin), runs `pg_dump` to the
USB SSD (`/mnt/data/backups`), and uploads to R2 with `rclone`. The R2 remote is
built from `RCLONE_CONFIG_R2_*` env vars, so it's fully declarative.

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
Tune the schedule/retention via the service's env in `docker-compose.yml`
(`BACKUP_HOUR`, `BACKUP_MINUTE`, `BACKUP_KEEP`). To take a backup immediately
(e.g. to verify R2 works):
```bash
docker compose run --rm -e BACKUP_ON_START=true backup
```

**Restore:**
```bash
# from a local dump on the SSD
gunzip -c /mnt/data/backups/wg-YYYYMMDD-HHMMSS.sql.gz \
  | docker compose exec -T db psql -U wg -d wg

# or pull one from R2 first
docker compose exec -T backup rclone copy r2:wg-backups/wg-YYYYMMDD-HHMMSS.sql.gz /backups/
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
docker compose build
docker compose up -d        # recreates changed services; migrate runs first
```
The PWA auto-updates on clients (Workbox `autoUpdate`) on next load. To free space:
`docker image prune -f`.

---

## 9. Health checklist

| Check | Command |
|-------|---------|
| Containers up | `docker compose ps` |
| DB healthy | `docker compose exec db pg_isready -U wg` |
| Data on USB | `ls /mnt/data/pgdata` (non-empty) |
| API + proxy | `curl http://127.0.0.1/api/health` |
| Public reachable | open `https://wg.yourdomain.com` |
| Tunnel up | `docker compose logs cloudflared` |
| Backups | `docker compose logs backup` (shows next run); `ls /mnt/data/backups` |
| Logs | `docker compose logs -f api worker` |

---

## 10. Notes & gotchas

- **arm64 images.** Build on the Pi or cross-build with buildx `--platform linux/arm64`.
  x86 images won't run.
- **Postgres data lives on the USB SSD** (`/mnt/data/pgdata` bind mount). The SD card
  is disposable; if it dies, reflash, reinstall Docker, `git clone`, `compose up`,
  and the data on the SSD (plus R2 backups) survives.
- **Migrations must be committed** before deploy (`pnpm db:generate`). The `migrate`
  container fails fast if `api/drizzle/` is empty.
- **VAPID keys are permanent.** Regenerating invalidates all push subscriptions.
- **Push needs the Pi online.** Home outage = missed reminders (accepted per spec).
- **Memory budget (4 GB):** the whole stack idles around ~0.5–0.7 GB — ample headroom.
