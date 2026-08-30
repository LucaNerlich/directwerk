# syntax=docker/dockerfile:1
#
# Coolify
#   Base Directory: repository root (.) — not directwerk-studio/
#   Dockerfile: directwerk-studio/Dockerfile
#   Port: 3003
#
# Local:
#   docker build -f directwerk-studio/Dockerfile -t directwerk-studio:local .

FROM node:22-alpine AS build
WORKDIR /workspace

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}/bin:${PATH}"
RUN apk add --no-cache bash \
    && wget -qO- https://get.pnpm.io/install.sh \
        | env PNPM_VERSION=12.0.0-rc.5 ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -

COPY . /ctx
RUN chmod +x /ctx/scripts/docker-assemble-app.sh \
    && /ctx/scripts/docker-assemble-app.sh directwerk-studio

RUN pnpm install --frozen-lockfile --filter directwerk-studio...

ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p directwerk-studio/public \
    && pnpm --filter directwerk-studio build \
    && pnpm deploy --filter=directwerk-studio --prod --legacy /deploy

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3003
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=build /deploy ./

RUN chown -R nextjs:nextjs /app

USER nextjs
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -p ${PORT}"]
