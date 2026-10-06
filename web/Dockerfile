# PWA build + Caddy static server / reverse proxy (context = repo root).
# No build-time config: API is same-origin, VAPID key is fetched from the api.

FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile
COPY shared/ shared/
COPY web/ web/
RUN pnpm --filter @wg/shared build
RUN pnpm --filter @wg/web build

FROM caddy:2-alpine
COPY web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/web/dist /srv
