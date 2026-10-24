# syntax=docker/dockerfile:1
#
# Coolify
#   Base Directory: repository root (.) — not directwerk-docs/
#   Dockerfile: directwerk-docs/Dockerfile
#   Port: 3006
#
# Local:
#   docker build -f directwerk-docs/Dockerfile -t directwerk-docs:local .

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

RUN cp /ctx/package.json /ctx/pnpm-lock.yaml /ctx/pnpm-workspace.yaml . \
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

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter directwerk-docs...

ENV VITEPRESS_LAST_UPDATED=0
RUN pnpm --filter directwerk-docs build \
    && pnpm deploy --filter=directwerk-docs --prod --legacy /deploy \
    && mkdir -p /deploy/docs/.vitepress \
    && cp -a directwerk-docs/docs/.vitepress/dist /deploy/docs/.vitepress/dist

FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3006
ENV HOSTNAME=0.0.0.0

RUN addgroup -S docs && adduser -S docs -G docs

COPY --from=build --chown=docs:docs /deploy ./

USER docs
EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "node node_modules/serve/build/main.js docs/.vitepress/dist --listen tcp://0.0.0.0:${PORT} --no-clipboard"]
