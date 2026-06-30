#!/bin/sh
# Dockerized nightly Postgres backup → Cloudflare R2 (S3-compatible) via rclone.
#
# Everything is configured through env (see docker-compose.yml / .env): the R2
# remote is synthesised from RCLONE_CONFIG_R2_* vars, so there is no host-level
# rclone install, no interactive `rclone config`, and no systemd timer. The
# container just sleeps until the next scheduled time and runs the dump.
set -eu

: "${BACKUP_HOUR:=3}"        # local hour to run (TZ from the image, Europe/Berlin)
: "${BACKUP_MINUTE:=30}"
: "${BACKUP_ON_START:=false}" # run once immediately (handy to test)
: "${R2_BUCKET:?R2_BUCKET is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"

run_backup() {
  stamp=$(date +%Y%m%d-%H%M%S)
  file="wg-$stamp.sql.gz"
  echo "[backup] $(date -Iseconds) streaming $file → r2:$R2_BUCKET"
  # Stream straight to R2 — no local file, no disk on the Pi. rcat reads stdin.
  pg_dump "$DATABASE_URL" | gzip | rclone rcat "r2:$R2_BUCKET/$file"
  # Retention lives on R2 (bucket lifecycle rule), not here.
  echo "[backup] done"
}

[ "$BACKUP_ON_START" = "true" ] && run_backup || true

while true; do
  # Seconds until the next BACKUP_HOUR:BACKUP_MINUTE (10# forces base-10 so a
  # leading-zero hour like 08 isn't parsed as octal). Avoids busybox `date -d`.
  now=$((10#$(date +%H) * 3600 + 10#$(date +%M) * 60 + 10#$(date +%S)))
  target=$((BACKUP_HOUR * 3600 + BACKUP_MINUTE * 60))
  delta=$((target - now))
  [ "$delta" -le 0 ] && delta=$((delta + 86400))
  echo "[backup] next run in ${delta}s (${BACKUP_HOUR}:${BACKUP_MINUTE} ${TZ:-UTC})"
  sleep "$delta"
  run_backup || echo "[backup] FAILED — will retry next cycle"
done
