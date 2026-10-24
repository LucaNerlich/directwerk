# syntax=docker/dockerfile:1
#
# Coolify
#   Base Directory: repository root (.) — not directwerk-web/
#   Dockerfile: directwerk-web/Dockerfile
#   Port: 3004
#
# Local:
#   docker build -f directwerk-web/Dockerfile -t directwerk-web:local .

FROM node:24-alpine AS build
WORKDIR /workspace

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}/bin:${PATH}"
# Keep the pnpm version in sync with the root package.json ("packageManager" and
# engines.pnpm). Use the npm/JS install, not the get.pnpm.io standalone native
# binary: on Alpine (musl) that native binary cannot delegate to a 10.x
# packageManager pin and fails closed with ERR_PNPM_PNPM_ENGINE_IDENTITY_UNVERIFIABLE
# because pnpm never published a 10.x musl platform binary (pnpm/pnpm#13622). The JS
# install has no native binary to verify and matches the pin, so it never delegates.
RUN apk add --no-cache bash \
    && npm install -g pnpm@10.33.2

COPY . /ctx
RUN chmod +x /ctx/scripts/docker-assemble-app.sh \
    && /ctx/scripts/docker-assemble-app.sh directwerk-web

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter directwerk-web...

ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p directwerk-web/public \
    && pnpm --filter directwerk-web build \
    && pnpm deploy --filter=directwerk-web --prod --legacy /deploy \
    && cp -a directwerk-web/.next /deploy/.next \
    && cp -a directwerk-web/public /deploy/public

FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3004
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=build --chown=nextjs:nextjs /deploy ./
COPY --from=build --chown=nextjs:nextjs /workspace/packages/next-config /packages/next-config

USER nextjs
EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -p ${PORT}"]
