#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/docs/openapi/directwerk-api.json"

if [[ "${1:-}" == "--curl" ]]; then
  URL="${DIRECTWERK_API_URL:-http://localhost:8080}/v3/api-docs"
  mkdir -p "$(dirname "$OUT")"
  curl -sf "$URL" -o "$OUT"
  echo "Exported OpenAPI spec via curl to ${OUT}"
  exit 0
fi

# Preferred: boot Spring test context and write springdoc output (no manual server).
cd "${ROOT}/../Directwerk"
./gradlew :directwerk-app:exportOpenApi -q
echo "Exported OpenAPI spec to ${OUT}"
