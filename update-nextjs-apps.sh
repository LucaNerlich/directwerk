#!/usr/bin/env bash
# Build, update dependencies, and rebuild every Next.js app in the workspace.
# Usage: ./update-nextjs-apps.sh [app ...]   (defaults to all Next.js apps)
set -euo pipefail

# This repo uses pnpm (see "packageManager" in package.json and pnpm-lock.yaml).
PM="${PM:-pnpm}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APPS=(
    homepage
    directwerk-admin
    directwerk-studio
    directwerk-web
)

# Allow overriding the app list via CLI args.
if [[ $# -gt 0 ]]; then
    APPS=("$@")
fi

build_all() {
    for app in "${APPS[@]}"; do
        target="$DIR/$app"
        if [[ ! -f "$target/package.json" ]]; then
            echo "==> SKIP $app (no package.json)" >&2
            continue
        fi
        echo "================================================================"
        echo "==> $app: $PM run build"
        echo "================================================================"
        (cd "$target" && "$PM" run build)
    done
}

build_all

echo "==> workspace: $PM update"
# Update at the workspace root so all apps + packages/ui stay in lockstep.
# pnpm's minimumReleaseAge guard may exit non-zero to skip too-new releases; that's not a failure.
if ! (cd "$DIR" && "$PM" update); then
    echo "==> $PM update exited non-zero (e.g. minimumReleaseAge guard); continuing" >&2
fi

build_all

echo "Done."
