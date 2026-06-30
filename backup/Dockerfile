# Nightly DB backup → Cloudflare R2. pg_dump major must match the db (postgres 16).
# Streams the dump straight to R2 (rclone rcat) — no local volume.
FROM postgres:16-alpine
RUN apk add --no-cache rclone tzdata
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh
ENV TZ=Europe/Berlin
ENTRYPOINT ["/usr/local/bin/backup.sh"]
