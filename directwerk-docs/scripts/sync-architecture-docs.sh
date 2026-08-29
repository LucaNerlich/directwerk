#!/usr/bin/env bash
# Regenerate public architecture pages from internal canonical docs.
# Run from repo root after editing docs/asset-storage.md or docs/payment.md.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
python3 "$ROOT/directwerk-docs/scripts/sync-architecture-docs.py"
