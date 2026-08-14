#!/bin/bash
# Builds and starts publish apps in production mode inside a tmux session.
# Windows: studio (3003) · homepage (3002) · directwerk-admin (3001) · directwerk-web (3004) · example-fe (3000)
# Usage: ./run-start.sh

SESSION="publish-start"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

tmux kill-session -t "$SESSION" 2>/dev/null

tmux new-session  -d -s "$SESSION" -n "studio"        -c "$DIR/directwerk-studio"
tmux send-keys    -t "$SESSION:studio"        "pnpm run build && pnpm run start" Enter

tmux new-window   -t "$SESSION"  -n "homepage"      -c "$DIR/homepage"
tmux send-keys    -t "$SESSION:homepage"      "pnpm run build && pnpm run start" Enter

tmux new-window   -t "$SESSION"  -n "directwerk-admin"  -c "$DIR/directwerk-admin"
tmux send-keys    -t "$SESSION:directwerk-admin" "pnpm run build && pnpm run start" Enter

tmux new-window   -t "$SESSION"  -n "directwerk-web"   -c "$DIR/directwerk-web"
tmux send-keys    -t "$SESSION:directwerk-web"   "pnpm run build && pnpm run start" Enter

tmux new-window   -t "$SESSION"  -n "example-fe"    -c "$DIR/example-fe"
tmux send-keys    -t "$SESSION:example-fe"    "pnpm run build && pnpm run start" Enter

tmux select-window -t "$SESSION:studio"

if [ -n "$TMUX" ]; then
    tmux switch-client -t "$SESSION"
else
    tmux attach-session -t "$SESSION"
fi
