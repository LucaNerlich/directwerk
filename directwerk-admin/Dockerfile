# syntax=docker/dockerfile:1
#
# Coolify
#   Build context: . (monorepo root — required for workspace packages)
#   Dockerfile: directwerk-admin/Dockerfile
#   Port: 3001
#
# Local:
#   docker build -f directwerk-admin/Dockerfile -t directwerk-admin:local .

FROM node:22-alpine AS build
WORKDIR /workspace

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}/bin:${PATH}"
RUN apk add --no-cache bash \
    && wget -qO- https://get.pnpm.io/install.sh \
        | env PNPM_VERSION=12.0.0-rc.5 ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY directwerk-admin/package.json ./directwerk-admin/

RUN pnpm install --frozen-lockfile --filter directwerk-admin...

COPY directwerk-admin ./directwerk-admin

ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p directwerk-admin/public \
    && pnpm --filter directwerk-admin build \
    && pnpm deploy --filter=directwerk-admin --prod --legacy /deploy

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=build /deploy ./

RUN chown -R nextjs:nextjs /app

USER nextjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -p ${PORT}"]
