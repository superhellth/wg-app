# WG App — Deployment Guide

End-to-end deployment of the WG app onto a **Raspberry Pi 4 Model B**, exposed via **Cloudflare Tunnel**, served by **Caddy**, with **PostgreSQL** on a USB SSD and offsite backups to **Cloudflare R2**.

Architecture recap (see `target_technical.md`):

```
            Internet (HTTPS)
                  │
          Cloudflare Tunnel            (no port-forwarding)
                  │
   ┌──────────────┴───────────────┐  Raspberry Pi 4
   │            Caddy             │  :80 (local)
   │   /        → static PWA      │  /var/www/wg-app
   │   /api/*   → reverse_proxy   │  → Fastify :3000
   └──────────────┬───────────────┘
                  │
        ┌─────────┴─────────┐
        │  Fastify API      │  systemd: wg-api.service
        │  Cron worker      │  systemd: wg-worker.service / timer
        └─────────┬─────────┘
                  │
            PostgreSQL          data dir on USB SSD
```

---

## 0. Prerequisites

**On your dev machine (Windows):**
- Node 20+ and pnpm 10+
- A Cloudflare account + a domain managed by Cloudflare (free plan is fine)
- A Cloudflare R2 bucket (for backups)

**Hardware:**
- Raspberry Pi 4 Model B (2 GB+ RAM)
- microSD card (boot only) — 16 GB+
- **USB SSD or good USB stick** (PostgreSQL data + backups staging) — strongly recommended for write endurance

---

## 1. Prepare the Raspberry Pi

### 1.1 Flash the OS
1. Use **Raspberry Pi Imager** → choose **Raspberry Pi OS Lite (64-bit)** (no desktop).
2. In the imager's settings (gear icon): set hostname (e.g. `wgpi`), enable **SSH**, set username/password, configure Wi-Fi/locale.
3. Flash the SD, boot the Pi, then SSH in:
   ```bash
   ssh youruser@wgpi.local
   ```

### 1.2 Update the system
```bash
sudo apt update && sudo apt full-upgrade -y
sudo reboot
```

### 1.3 Mount the USB SSD for Postgres data
Plug in the USB SSD. Identify and format it (⚠️ this **erases** the device — pick the right one):
```bash
lsblk                         # find the device, e.g. /dev/sda
sudo mkfs.ext4 /dev/sda1      # if it already has a partition; else create one with fdisk
sudo mkdir -p /mnt/data
```
Get the UUID and add to `/etc/fstab` so it mounts on boot:
```bash
sudo blkid /dev/sda1          # copy the UUID=...
echo 'UUID=<your-uuid>  /mnt/data  ext4  defaults,noatime  0  2' | sudo tee -a /etc/fstab
sudo mount -a
sudo chown -R "$USER":"$USER" /mnt/data
```
> `noatime` reduces writes (less flash wear).

---

## 2. Install runtimes

### 2.1 Node + pnpm
```bash
# Node 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm@10

node --version && pnpm --version
```

### 2.2 PostgreSQL
```bash
sudo apt install -y postgresql
```

---

## 3. Configure PostgreSQL (data on USB, low write wear)

### 3.1 Move the data directory to the USB SSD
```bash
sudo systemctl stop postgresql

# Find the version dir (e.g. 15 or 16)
ls /var/lib/postgresql/

# Copy existing cluster to the SSD (replace 16 with your version)
sudo rsync -av /var/lib/postgresql/16/main/ /mnt/data/pgdata/
sudo chown -R postgres:postgres /mnt/data/pgdata
sudo chmod 700 /mnt/data/pgdata
```

Point Postgres at the new dir — edit `/etc/postgresql/16/main/postgresql.conf`:
```conf
data_directory = '/mnt/data/pgdata'

# ── reduce SD/flash wear & noise ──
logging_collector = off
log_statement = 'none'
log_min_messages = warning
# moderate WAL footprint (defaults are fine for a tiny DB; keep checkpoints relaxed)
checkpoint_timeout = 15min
max_wal_size = 512MB
min_wal_size = 80MB
synchronous_commit = on
```

Restart and verify:
```bash
sudo systemctl start postgresql
sudo -u postgres psql -c "SHOW data_directory;"   # should print /mnt/data/pgdata
```

### 3.2 Create the database + user
```bash
sudo -u postgres psql <<'SQL'
CREATE USER wg WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE wg OWNER wg;
GRANT ALL PRIVILEGES ON DATABASE wg TO wg;
SQL
```
Connection string for later:
```
postgres://wg:choose-a-strong-password@localhost:5432/wg
```

---

## 4. Get the app onto the Pi

### Option A — clone from git (recommended)
```bash
sudo mkdir -p /opt/wg-app && sudo chown "$USER":"$USER" /opt/wg-app
git clone <your-repo-url> /opt/wg-app
cd /opt/wg-app
pnpm install --frozen-lockfile
```

### Option B — build on dev machine, copy `dist` over
Build locally then `scp` the `web/dist` and the compiled `api/dist` + `node_modules`. Cloning + building on the Pi (Option A) is simpler; the Pi 4 builds this app fine.

---

## 5. Configure environment

Generate the VAPID keypair (once):
```bash
cd /opt/wg-app
npx web-push generate-vapid-keys
```

Create `api/.env` (copy from `.env.example`):
```bash
cp .env.example api/.env
nano api/.env
```
Fill in:
```dotenv
DATABASE_URL=postgres://wg:choose-a-strong-password@localhost:5432/wg
PORT=3000
HOST=127.0.0.1
WG_TOKEN_SECRET=<long random string>
INVITE_SECRET=<long random string>
VAPID_PUBLIC_KEY=<from web-push output>
VAPID_PRIVATE_KEY=<from web-push output>
VAPID_SUBJECT=mailto:you@example.com
```
> Generate secrets with: `openssl rand -base64 48`

For the **web build**, the public values are baked at build time. Create `web/.env.production`:
```dotenv
VITE_API_URL=https://wg.yourdomain.com
VITE_VAPID_PUBLIC_KEY=<same VAPID public key>
```

---

## 6. Build + migrate

```bash
cd /opt/wg-app

# build shared → api → web (topological)
pnpm build

# apply database schema
pnpm db:migrate
```
> First time, generate migrations on your dev machine with `pnpm db:generate` and commit the `api/drizzle/` folder, then just `db:migrate` on the Pi.

The built PWA is in `web/dist`. Put it where Caddy will serve it:
```bash
sudo mkdir -p /var/www/wg-app
sudo cp -r web/dist/* /var/www/wg-app/
```

---

## 7. Run API + worker as systemd services

### 7.1 API service
`sudo nano /etc/systemd/system/wg-api.service`:
```ini
[Unit]
Description=WG App API (Fastify)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=youruser
WorkingDirectory=/opt/wg-app/api
ExecStart=/usr/bin/node dist/index.js
EnvironmentFile=/opt/wg-app/api/.env
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 7.2 Cron worker (time-based push: chore overdue, meeting reminders)
If the worker is a separate entrypoint (e.g. `api/dist/worker.js`):
`sudo nano /etc/systemd/system/wg-worker.service`:
```ini
[Unit]
Description=WG App cron worker
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=youruser
WorkingDirectory=/opt/wg-app/api
ExecStart=/usr/bin/node dist/worker.js
EnvironmentFile=/opt/wg-app/api/.env
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```
> If you keep `node-cron` inside the API process instead, skip this service.

### 7.3 Enable + start
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wg-api.service
sudo systemctl enable --now wg-worker.service

# check
systemctl status wg-api.service
journalctl -u wg-api.service -f
curl http://127.0.0.1:3000/health      # → {"ok":true}
```

---

## 8. Install + configure Caddy (reverse proxy + static)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Because Cloudflare Tunnel terminates public TLS, Caddy serves plain HTTP locally on :80. Edit `/etc/caddy/Caddyfile`:
```caddy
:80 {
    root * /var/www/wg-app
    encode gzip

    handle /api/* {
        reverse_proxy 127.0.0.1:3000
    }

    handle {
        try_files {path} /index.html
        file_server
    }
}
```
Reload:
```bash
sudo systemctl restart caddy
curl http://127.0.0.1/health  || true     # static served; /api/health via proxy:
curl http://127.0.0.1/api/health           # → {"ok":true}
```

---

## 9. Expose via Cloudflare Tunnel

```bash
# install cloudflared (ARM64)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o cloudflared
sudo install -m 755 cloudflared /usr/local/bin/cloudflared

# authenticate (opens a browser URL — open it on any device, pick your domain)
cloudflared tunnel login

# create a named tunnel
cloudflared tunnel create wg
# note the Tunnel ID + the credentials file path it prints
```

Create `/etc/cloudflared/config.yml`:
```yaml
tunnel: <TUNNEL-ID>
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: wg.yourdomain.com
    service: http://127.0.0.1:80
  - service: http_status:404
```

Route DNS + run as a service:
```bash
sudo cloudflared tunnel route dns wg wg.yourdomain.com
sudo cloudflared service install
sudo systemctl enable --now cloudflared
systemctl status cloudflared
```

Visit `https://wg.yourdomain.com` — the PWA should load and `/api/health` should respond.

---

## 10. Offsite backups → Cloudflare R2

### 10.1 Install + configure rclone
```bash
sudo apt install -y rclone
rclone config
```
Create a remote of type **S3 → Cloudflare R2** (`provider = Cloudflare`), using your R2 Access Key ID / Secret and the R2 S3 endpoint (`https://<account-id>.r2.cloudflarestorage.com`). Name it `r2`.

### 10.2 Backup script
`nano /opt/wg-app/scripts/backup.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="/mnt/data/backups/wg-$STAMP.sql.gz"
mkdir -p /mnt/data/backups
pg_dump "postgres://wg:choose-a-strong-password@localhost:5432/wg" | gzip > "$OUT"

# upload offsite
rclone copy "$OUT" r2:wg-backups/

# keep last 14 local
ls -1t /mnt/data/backups/wg-*.sql.gz | tail -n +15 | xargs -r rm --
```
```bash
chmod +x /opt/wg-app/scripts/backup.sh
```

### 10.3 Schedule nightly (systemd timer)
`sudo nano /etc/systemd/system/wg-backup.service`:
```ini
[Unit]
Description=WG App nightly DB backup

[Service]
Type=oneshot
ExecStart=/opt/wg-app/scripts/backup.sh
```
`sudo nano /etc/systemd/system/wg-backup.timer`:
```ini
[Unit]
Description=Run WG backup nightly

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wg-backup.timer
sudo systemctl list-timers wg-backup.timer
# test once:
sudo systemctl start wg-backup.service && journalctl -u wg-backup.service -n 20
```

**Restore** (when needed):
```bash
gunzip -c wg-YYYYMMDD-HHMMSS.sql.gz | psql "postgres://wg:...@localhost:5432/wg"
```

---

## 11. Install the app on phones (distribution)

No app stores. Each roommate:

**Android (Chrome):**
1. Open `https://wg.yourdomain.com`.
2. Menu → **Add to Home screen** (or the install prompt).
3. Allow notifications when asked.

**iOS (Safari, iOS 16.4+):**
1. Open `https://wg.yourdomain.com` in **Safari**.
2. Share button → **Add to Home Screen**. (Push only works from the home-screen-installed app, **not** a Safari tab.)
3. Open the app from the home screen, allow notifications.

First member creates the WG and adds the roster; everyone else joins via the **invite link** (expires after 24h, reusable within that window) and picks their name from the roster.

---

## 12. Updating the app

```bash
cd /opt/wg-app
git pull
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate                      # if schema changed
sudo cp -r web/dist/* /var/www/wg-app/
sudo systemctl restart wg-api.service wg-worker.service
```
The PWA auto-updates on clients (Workbox `autoUpdate`) on next load.

---

## 13. Health checklist

| Check | Command |
|-------|---------|
| Postgres up, data on USB | `sudo -u postgres psql -c "SHOW data_directory;"` |
| API healthy | `curl http://127.0.0.1:3000/health` |
| Proxy + static | `curl http://127.0.0.1/api/health` |
| Public reachable | open `https://wg.yourdomain.com` |
| Services enabled | `systemctl is-enabled wg-api caddy cloudflared postgresql` |
| Backup timer armed | `systemctl list-timers wg-backup.timer` |
| Logs | `journalctl -u wg-api -f` |

---

## 14. Notes & gotchas

- **Push needs the Pi online.** Home outage = missed reminders. Acceptable per spec.
- **SD card is disposable.** Postgres data + backups live on the USB SSD; backups also go offsite to R2. If the SD dies, reflash and re-deploy; data survives.
- **VAPID keys are permanent.** Regenerating them invalidates all existing push subscriptions (everyone must re-enable notifications).
- **HOST=127.0.0.1** for the API — it should only be reachable via Caddy, never directly exposed.
- **Secrets** live only in `api/.env` on the Pi (gitignored). Never commit them.
