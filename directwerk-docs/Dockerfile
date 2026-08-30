# syntax=docker/dockerfile:1
#
# Coolify
#   Base Directory: repository root (.) — not directwerk-docs/
#   Dockerfile: directwerk-docs/Dockerfile
#   Ports Exposes: 3006 (must match ENV PORT below)
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

COPY . /ctx

RUN cp /ctx/package.json /ctx/pnpm-lock.yaml /ctx/pnpm-workspace.yaml /ctx/.npmrc . \
    && mkdir -p directwerk-docs \
    && if [ -f /ctx/directwerk-docs/package.json ]; then \
         cp -a /ctx/directwerk-docs/. ./directwerk-docs/; \
       else \
         cp /ctx/package.json ./directwerk-docs/package.json; \
         for entry in /ctx/* /ctx/.[!.]* /ctx/..?*; do \
           [ -e "$entry" ] || continue; \
           base=$(basename "$entry"); \
           case "$base" in \
             .|..|package.json|pnpm-lock.yaml|pnpm-workspace.yaml|.npmrc|packages|Directwerk|directwerk-admin|directwerk-studio|directwerk-web|directwerk-docs|homepage|docker|node_modules|.git|.github|.cursor|.idea|.vscode) continue ;; \
           esac; \
           cp -a "$entry" "./directwerk-docs/$base"; \
         done; \
       fi

RUN pnpm install --frozen-lockfile --filter directwerk-docs...

ENV NEXT_TELEMETRY_DISABLED=1
ENV VITEPRESS_LAST_UPDATED=0
RUN pnpm --filter directwerk-docs build

FROM nginx:1.27-alpine
ENV PORT=3006
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /workspace/directwerk-docs/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/directwerk-docs/docs/.vitepress/dist /usr/share/nginx/html

EXPOSE 3006
CMD ["nginx", "-g", "daemon off;"]
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3006/api/health >/dev/null || exit 1
