# API + cron worker image (monorepo build, context = repo root).
# Two stages reused by docker-compose:
#   target: build   → full toolchain (used by the one-shot `migrate` service)
#   target: runtime → slim prod image (used by `api` and `worker`)

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── build: install all deps, build shared + api, prune to a deployable ──
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile
COPY shared/ shared/
COPY api/ api/
RUN pnpm --filter @wg/shared build \
  && pnpm --filter @wg/api build \
  && pnpm --filter @wg/api deploy --prod /app

# ── runtime: only the deployable (no dev deps, no symlinks) ──
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["node", "dist/index.js"]
