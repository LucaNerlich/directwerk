#!/bin/sh
# Place monorepo workspace files and one app package under /workspace for pnpm.
# Supports two Coolify/Docker context layouts:
#   1. Monorepo root context — app lives at ${APP_NAME}/
#   2. App base directory — workspace files at context root, app sources also at root
set -eu

APP_NAME="${1:?APP_NAME required}"
CTX="${2:-/ctx}"
WORKSPACE="${3:-/workspace}"

cd "$WORKSPACE"

if [ ! -f "$CTX/pnpm-workspace.yaml" ] || [ ! -d "$CTX/packages" ]; then
    echo "error: build context is missing monorepo workspace files (pnpm-workspace.yaml, packages/)." >&2
    echo "Set Coolify Base Directory to the repository root, not ${APP_NAME}/." >&2
    exit 1
fi

cp "$CTX/package.json" "$CTX/pnpm-lock.yaml" "$CTX/pnpm-workspace.yaml" "$CTX/.npmrc" .
cp -r "$CTX/packages" ./packages
mkdir -p "$APP_NAME"

if [ -f "$CTX/$APP_NAME/next.config.ts" ] || [ -d "$CTX/$APP_NAME/app" ]; then
    cp -a "$CTX/$APP_NAME/." "./$APP_NAME/"
elif [ -f "$CTX/next.config.ts" ] || [ -d "$CTX/app" ]; then
    if [ -f "$CTX/$APP_NAME/package.json" ]; then
        cp "$CTX/$APP_NAME/package.json" "./$APP_NAME/package.json"
    else
        cp "$CTX/package.json" "./$APP_NAME/package.json"
    fi
    for entry in "$CTX"/* "$CTX"/.[!.]* "$CTX"/..?*; do
        [ -e "$entry" ] || continue
        base=$(basename "$entry")
        case "$base" in
            .|..|package.json|pnpm-lock.yaml|pnpm-workspace.yaml|.npmrc|packages|Directwerk|directwerk-admin|directwerk-studio|directwerk-web|directwerk-docs|homepage|docker|node_modules|.git|.github|.cursor|.idea|.vscode)
                continue
                ;;
        esac
        cp -a "$entry" "./$APP_NAME/$base"
    done
else
    echo "error: could not find ${APP_NAME} sources in build context." >&2
    exit 1
fi

if [ ! -f "./$APP_NAME/package.json" ]; then
    echo "error: ${APP_NAME}/package.json missing after assemble." >&2
    exit 1
fi
