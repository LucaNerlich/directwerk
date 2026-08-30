# syntax=docker/dockerfile:1
#
# Coolify
#   Base Directory: repository root (.) — not directwerk-docs/
#   Dockerfile: directwerk-docs/Dockerfile
#   Port: 3006
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

ENV VITEPRESS_LAST_UPDATED=0
RUN pnpm --filter directwerk-docs build \
    && pnpm deploy --filter=directwerk-docs --prod --legacy /deploy \
    && mkdir -p /deploy/docs/.vitepress \
    && cp -a directwerk-docs/docs/.vitepress/dist /deploy/docs/.vitepress/dist

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3006
ENV HOSTNAME=0.0.0.0

RUN addgroup -S docs && adduser -S docs -G docs

COPY --from=build /deploy ./

RUN chown -R docs:docs /app

USER docs
EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "node node_modules/serve/build/main.js docs/.vitepress/dist --listen tcp://0.0.0.0:${PORT} --no-clipboard"]
