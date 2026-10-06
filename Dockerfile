# API + cron worker image (monorepo build, context = repo root).
# Only the runtime stage is used by docker-compose for `api`, `worker`
# and `migrate`

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
RUN pnpm --filter @wg/shared build
RUN pnpm --filter @wg/api build
RUN pnpm --filter @wg/api deploy --prod --legacy /app

# ── runtime: only the deployable (no dev deps, no symlinks) ──
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["node", "dist/index.js"]
