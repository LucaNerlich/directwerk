#!/bin/bash
# Builds and starts publish apps in production mode inside a tmux session.
# Windows: studio (3003) · homepage (3002) · publish-admin (3001) · publish-web (3004) · example-fe (3000)
# Usage: ./run-start.sh

SESSION="publish-start"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

tmux kill-session -t "$SESSION" 2>/dev/null

tmux new-session  -d -s "$SESSION" -n "studio"        -c "$DIR/publish-studio"
tmux send-keys    -t "$SESSION:studio"        "pnpm run build && pnpm run start" Enter

tmux new-window   -t "$SESSION"  -n "homepage"      -c "$DIR/homepage"
tmux send-keys    -t "$SESSION:homepage"      "pnpm run build && pnpm run start" Enter

tmux new-window   -t "$SESSION"  -n "publish-admin"  -c "$DIR/publish-admin"
tmux send-keys    -t "$SESSION:publish-admin" "pnpm run build && pnpm run start" Enter

tmux new-window   -t "$SESSION"  -n "publish-web"   -c "$DIR/publish-web"
tmux send-keys    -t "$SESSION:publish-web"   "pnpm run build && pnpm run start" Enter

tmux new-window   -t "$SESSION"  -n "example-fe"    -c "$DIR/example-fe"
tmux send-keys    -t "$SESSION:example-fe"    "pnpm run build && pnpm run start" Enter

tmux select-window -t "$SESSION:studio"

if [ -n "$TMUX" ]; then
    tmux switch-client -t "$SESSION"
else
    tmux attach-session -t "$SESSION"
fi
