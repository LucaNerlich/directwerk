#!/bin/bash
# Starts the publish apps in one tmux session.
# Usage: ./scripts/dev.sh [dev|start]   (default: dev)
#
# Dev windows: studio (3003) · homepage (3005) · directwerk-admin (3001) ·
#              directwerk-web (3004) · docs (5173)
# Navigate windows: Ctrl+B [0-4] or Ctrl+B n/p
set -euo pipefail

MODE="${1:-dev}"
case "$MODE" in
    dev)   COMMAND="pnpm run dev" ;;
    start) COMMAND="pnpm run build && pnpm run start" ;;
    *)     echo "Usage: $0 [dev|start]" >&2; exit 2 ;;
esac

SESSION="publish-$MODE"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

APPS=(directwerk-studio homepage directwerk-admin directwerk-web)
# Dev-only, matching the old start launcher: the docs site serves on 3006, not 5173.
if [ "$MODE" = "dev" ]; then
    APPS+=(directwerk-docs)
fi

for app in "${APPS[@]}"; do
    if [ ! -d "$DIR/$app" ]; then
        echo "Missing app directory: $DIR/$app" >&2
        exit 1
    fi
done

tmux kill-session -t "$SESSION" 2>/dev/null || true

first=1
for app in "${APPS[@]}"; do
    if [ "$first" = 1 ]; then
        tmux new-session -d -s "$SESSION" -n "$app" -c "$DIR/$app"
        first=0
    else
        tmux new-window -t "$SESSION" -n "$app" -c "$DIR/$app"
    fi
    tmux send-keys -t "$SESSION:$app" "$COMMAND" Enter
done

tmux select-window -t "$SESSION:${APPS[0]}"

if [ -n "${TMUX:-}" ]; then
    tmux switch-client -t "$SESSION"
else
    tmux attach-session -t "$SESSION"
fi
