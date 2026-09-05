#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/docs/openapi/directwerk-api.json"

if [[ "${1:-}" == "--curl" ]]; then
  URL="${DIRECTWERK_API_URL:-http://localhost:8080}/v3/api-docs"
  mkdir -p "$(dirname "$OUT")"
  curl -sf "$URL" -o "$OUT"
  # Freshness signal: record the export revision/date so a stale checked-in
  # artifact is distinguishable from a current one.
  if git -C "${ROOT}/.." rev-parse --short HEAD >/dev/null 2>&1; then
    printf '{"exportedAt":"%s","exportedCommit":"%s"}\n' \
      "$(date -u +%FT%TZ)" \
      "$(git -C "${ROOT}/.." rev-parse --short HEAD)" \
      > "${ROOT}/docs/openapi/.export-meta.json"
  fi
  echo "Exported OpenAPI spec via curl to ${OUT}"
  exit 0
fi

# Preferred: boot Spring test context and write springdoc output (no manual server).
cd "${ROOT}/../Directwerk"
./gradlew :directwerk-app:exportOpenApi -q
if git -C "${ROOT}/.." rev-parse --short HEAD >/dev/null 2>&1; then
  printf '{"exportedAt":"%s","exportedCommit":"%s"}\n' \
    "$(date -u +%FT%TZ)" \
    "$(git -C "${ROOT}/.." rev-parse --short HEAD)" \
    > "${ROOT}/docs/openapi/.export-meta.json"
fi
echo "Exported OpenAPI spec to ${OUT}"
