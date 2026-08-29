# syntax=docker/dockerfile:1
#
# Generic production image for pnpm-workspace Next.js apps.
# Build context: monorepo root.
#
#   docker build -f docker/nextjs.Dockerfile \
#     --build-arg APP_NAME=directwerk-admin --build-arg APP_PORT=3001 \
#     -t directwerk-admin:local .

ARG APP_NAME
ARG APP_PORT=3000

FROM node:22-alpine AS build
WORKDIR /workspace
ARG APP_NAME

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}/bin:${PATH}"
# https://pnpm.io/installation#in-a-docker-container
RUN apk add --no-cache bash \
    && wget -qO- https://get.pnpm.io/install.sh \
        | env PNPM_VERSION=12.0.0-rc.5 ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY "${APP_NAME}/package.json" "./${APP_NAME}/"

RUN pnpm install --frozen-lockfile --filter "${APP_NAME}..."

COPY "${APP_NAME}" "./${APP_NAME}"

ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p "${APP_NAME}/public" \
    && pnpm --filter "${APP_NAME}" build

FROM node:22-alpine AS runtime
WORKDIR /app
ARG APP_NAME
ARG APP_PORT

ENV APP_NAME=${APP_NAME}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=${APP_PORT}
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=build "/workspace/${APP_NAME}/.next/standalone" ./
COPY --from=build "/workspace/${APP_NAME}/.next/static" "./${APP_NAME}/.next/static"
COPY --from=build "/workspace/${APP_NAME}/public" "./${APP_NAME}/public"

USER nextjs
EXPOSE ${APP_PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "node \"${APP_NAME}/server.js\""]
