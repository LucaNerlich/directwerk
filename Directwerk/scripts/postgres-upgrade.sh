#!/usr/bin/env bash
# Upgrade a Directwerk Compose Postgres volume with pg_upgrade.
#
# Requires both the old and new official postgres Docker images (same major version
# for beta bumps, or major bump e.g. 19 -> 20). See docs/postgres_upgrade.md.
#
# Usage:
#   ./scripts/postgres-upgrade.sh OLD_IMAGE NEW_IMAGE [VOLUME_NAME]
#
# Example (19 beta2 -> beta3):
#   cd Directwerk
#   docker compose down
#   ./scripts/postgres-upgrade.sh postgres:19beta2-alpine postgres:19beta3-alpine
#   docker compose up -d

set -euo pipefail

OLD_IMAGE="${1:?Usage: $0 OLD_IMAGE NEW_IMAGE [VOLUME_NAME]}"
NEW_IMAGE="${2:?Usage: $0 OLD_IMAGE NEW_IMAGE [VOLUME_NAME]}"
VOLUME="${3:-directwerk_postgres_data}"
STAGING_VOL="${VOLUME}_pg_upgrade_old_bin"
PG_MAJOR="${PG_MAJOR:-19}"
OLD_DATA="/var/lib/postgresql/${PG_MAJOR}/docker"
NEW_DATA="/var/lib/postgresql/${PG_MAJOR}/docker-new"
DB_USER="${DB_USER:-myuser}"

if ! docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  echo "error: volume '$VOLUME' does not exist" >&2
  exit 1
fi

echo "==> Staging old Postgres binaries from $OLD_IMAGE"
docker volume create "$STAGING_VOL" >/dev/null
docker run --rm -v "$STAGING_VOL":/out "$OLD_IMAGE" sh -c 'cp -a /usr/local /out/usr_local'

run_pg_upgrade() {
  local mode="$1" # --check or --link
  docker run --rm \
    -v "$VOLUME":/var/lib/postgresql \
    -v "$STAGING_VOL":/old_pg:ro \
    -e OLD_DATA="$OLD_DATA" \
    -e NEW_DATA="$NEW_DATA" \
    -e DB_USER="$DB_USER" \
    -e UPGRADE_MODE="$mode" \
    "$NEW_IMAGE" sh -c '
      set -e
      rm -rf "$NEW_DATA"
      chown -R postgres:postgres "$(dirname "$OLD_DATA")"
      su postgres -c "initdb -D \"$NEW_DATA\" -U \"$DB_USER\" --no-instructions"
      su postgres -c "cd /tmp && pg_upgrade \
        --old-datadir=\"$OLD_DATA\" \
        --new-datadir=\"$NEW_DATA\" \
        --old-bindir=/old_pg/usr_local/bin \
        --new-bindir=/usr/local/bin \
        -U \"$DB_USER\" \
        $UPGRADE_MODE"
    '
}

echo "==> pg_upgrade --check ($OLD_IMAGE -> $NEW_IMAGE on volume $VOLUME)"
run_pg_upgrade --check

echo "==> pg_upgrade --link"
run_pg_upgrade --link

docker run --rm \
  -v "$VOLUME":/var/lib/postgresql \
  -e OLD_DATA="$OLD_DATA" \
  -e NEW_DATA="$NEW_DATA" \
  "$NEW_IMAGE" sh -c 'rm -rf "$OLD_DATA" && mv "$NEW_DATA" "$OLD_DATA"'

docker volume rm "$STAGING_VOL"

echo "==> Done. Start Postgres with the new image, e.g.:"
echo "    docker compose up -d postgres"
echo "Optional post-upgrade (inside the running container):"
echo "    docker compose exec postgres vacuumdb -U $DB_USER --all --analyze-in-stages --missing-stats-only"
echo "    docker compose exec postgres vacuumdb -U $DB_USER --all --analyze-only"
