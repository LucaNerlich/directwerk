# syntax=docker/dockerfile:1
#
# Coolify
#   Build context: . (monorepo root — required for workspace lockfile)
#   Dockerfile: directwerk-docs/Dockerfile
#   Port: 80
#
# Local:
#   docker build -f directwerk-docs/Dockerfile -t directwerk-docs:local .

FROM node:22-alpine AS build
WORKDIR /workspace

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}/bin:${PATH}"
RUN apk add --no-cache bash \
    && wget -qO- https://get.pnpm.io/install.sh \
        | env PNPM_VERSION=12.0.0-rc.5 ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY directwerk-docs/package.json ./directwerk-docs/

RUN pnpm install --frozen-lockfile --filter directwerk-docs...

COPY directwerk-docs ./directwerk-docs

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter directwerk-docs build

FROM nginx:1.27-alpine
COPY directwerk-docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/directwerk-docs/docs/.vitepress/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
