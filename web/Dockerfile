# PWA build + Caddy static server / reverse proxy (context = repo root).
# VITE_* values are baked at build time (passed as build args from compose).

FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile
COPY shared/ shared/
COPY web/ web/
ARG VITE_API_URL
ARG VITE_VAPID_PUBLIC_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
RUN pnpm --filter @wg/shared build
RUN pnpm --filter @wg/web build

FROM caddy:2-alpine
COPY web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/web/dist /srv
