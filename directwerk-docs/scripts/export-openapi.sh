#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/docs/openapi/directwerk-api.json"

write_export_metadata() {
  local exported_at exported_commit
  exported_at="$(date -u +%FT%TZ)"
  if exported_commit="$(git -C "${ROOT}/.." rev-parse --short HEAD 2>/dev/null)"; then
    printf '{"exportedAt":"%s","exportedCommit":"%s"}\n' \
      "${exported_at}" "${exported_commit}"
  else
    printf '{"exportedAt":"%s"}\n' "${exported_at}"
  fi > "${ROOT}/docs/openapi/.export-meta.json"
}

if [[ "${1:-}" == "--curl" ]]; then
  URL="${DIRECTWERK_API_URL:-http://localhost:8080}/v3/api-docs"
  mkdir -p "$(dirname "$OUT")"
  curl -sf "$URL" -o "$OUT"
  # Freshness signal: record the export revision/date so a stale checked-in
  # artifact is distinguishable from a current one.
  write_export_metadata
  echo "Exported OpenAPI spec via curl to ${OUT}"
  exit 0
fi

# Preferred: boot Spring test context and write springdoc output (no manual server).
cd "${ROOT}/../Directwerk"
./gradlew :directwerk-app:exportOpenApi -q
write_export_metadata
echo "Exported OpenAPI spec to ${OUT}"
