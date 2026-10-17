# syntax=docker/dockerfile:1.7
# ───────────── SATZIO API (NestJS + Prisma) – Multi-Stage-Build ─────────────
ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
# Optional: zusätzliche CA (z. B. Firmen-Proxy) per Build-Secret "extra_ca" – nur während des Builds.
# Hinweis: node:alpine bringt libssl3 mit (für Prisma) – kein Paketmanager nötig.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo

# Abhängigkeiten (gecacht, solange sich Lockfile/Manifeste nicht ändern)
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    pnpm install --frozen-lockfile --filter @satzio/api...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    pnpm --filter @satzio/shared build \
 && pnpm --filter @satzio/api build \
 && pnpm --filter @satzio/api deploy --prod --legacy /out \
 && cp -r apps/api/dist /out/dist \
 && cd /out && npx prisma generate

# Laufzeit: nur Produktionsabhängigkeiten, ohne Root-Rechte
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=build --chown=node:node /out /app
COPY --chown=node:node docker/api-entrypoint.sh /app/entrypoint.sh
RUN mkdir -p /data/uploads && chown -R node:node /data && chmod +x /app/entrypoint.sh
USER node
EXPOSE 3000
VOLUME ["/data/uploads"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1
# PID 1/Signale: docker compose "init: true" (tini von Docker)
ENTRYPOINT ["/app/entrypoint.sh"]
