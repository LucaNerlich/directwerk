# PostgreSQL Docker upgrades (Directwerk local / full-stack)

Directwerk Compose stacks use the official [`postgres`](https://hub.docker.com/_/postgres) image on **PostgreSQL 19 beta** (Alpine). Data is stored in a named volume mounted at `/var/lib/postgresql` (PG 18+ layout: actual cluster path is `/var/lib/postgresql/19/docker`).

**Important:** Bumping the image tag alone is not enough when the catalog version changes (typical for beta releases and all major releases). Postgres will refuse to start:

```text
FATAL:  database files are incompatible with server
DETAIL:  The database cluster was initialized with CATALOG_VERSION_NO …, but the server was compiled with CATALOG_VERSION_NO …
```

You must either **upgrade in place** (`pg_upgrade`), **dump and restore**, or **wipe and re-seed** (local dev only).

Related files:

| File | Role |
|------|------|
| [`Directwerk/docker-compose.yaml`](../docker-compose.yaml) | Infra-only (Postgres + Mailpit) |
| [`docker-compose.full-stack.yaml`](../../docker-compose.full-stack.yaml) | Full stack at monorepo root |
| [`scripts/postgres-upgrade.sh`](../scripts/postgres-upgrade.sh) | Automated `pg_upgrade` helper |

---

## When to use which approach

| Situation | Approach |
|-----------|----------|
| Local dev, seed data is fine | `docker compose down -v` then `up -d` — Flyway + dev seed recreate schema |
| Keep data, small DB, one-off | [Dump / restore](#dump--restore) |
| Keep data, larger DB, or routine beta bump | [pg_upgrade](#pg_upgrade-recommended) (script below) |

---

## pg_upgrade (recommended)

`pg_upgrade` rewrites system catalogs and reuses data files. With `--link`, files are hard-linked instead of copied (fast, same filesystem — works with our single-volume PG 18+ layout).

**Requirements:**

1. **Both** old and new Postgres binaries (two Docker image tags).
2. Compose stacks **stopped** (`docker compose down`).
3. Cluster owner is **`myuser`**, not `postgres` — the upgrade script passes `-U myuser`.

### Automated script

From `Directwerk/`:

```sh
docker compose down

./scripts/postgres-upgrade.sh OLD_IMAGE NEW_IMAGE [VOLUME_NAME]
# default volume: directwerk_postgres_data

docker compose up -d postgres
docker compose exec postgres pg_isready -U myuser -d mydatabase
```

**Example — 19 beta2 → beta3:**

```sh
./scripts/postgres-upgrade.sh postgres:19beta2-alpine postgres:19beta3-alpine
```

**Example — next beta (adjust tags when released):**

```sh
./scripts/postgres-upgrade.sh postgres:19beta3-alpine postgres:19beta4-alpine
```

**Example — future PG 20 major (update `PG_MAJOR` and compose paths):**

```sh
PG_MAJOR=20 ./scripts/postgres-upgrade.sh postgres:19-alpine postgres:20-alpine
```

After a **major** upgrade, confirm `PGDATA` in the new image (e.g. `/var/lib/postgresql/20/docker`) and update compose comments if the major version changes.

### What the script does

1. Copies `/usr/local` from the **old** image into a temporary Docker volume (old `pg_ctl`, `postgres`, etc.).
2. Runs `initdb` for an empty cluster at `…/19/docker-new` (same `myuser` install user).
3. Runs `pg_upgrade --check`, then `pg_upgrade --link`.
4. Removes the old `…/docker` directory and renames `docker-new` → `docker`.
5. Appends `host all all all scram-sha-256` to `pg_hba.conf` (the official image entrypoint normally does this on first init; manual `initdb` for `pg_upgrade` skips it, which breaks Compose TCP clients).
6. Removes the staging volume.

After upgrade, reload or restart Postgres if it is already running:

```sh
docker compose exec postgres psql -U myuser -d mydatabase -c "SELECT pg_reload_conf();"
```

Optional post-upgrade (recommended by Postgres):

```sh
docker compose exec postgres vacuumdb -U myuser --all --analyze-in-stages --missing-stats-only
docker compose exec postgres vacuumdb -U myuser --all --analyze-only
```

### Manual steps (if you prefer not to use the script)

```sh
docker compose down

docker volume create pg_old_bin
docker run --rm -v pg_old_bin:/out postgres:OLD_TAG \
  sh -c 'cp -a /usr/local /out/usr_local'

docker run --rm \
  -v directwerk_postgres_data:/var/lib/postgresql \
  -v pg_old_bin:/old_pg:ro \
  postgres:NEW_TAG sh -c '
    set -e
    OLD=/var/lib/postgresql/19/docker
    NEW=/var/lib/postgresql/19/docker-new
    rm -rf "$NEW"
    chown -R postgres:postgres /var/lib/postgresql/19
    su postgres -c "initdb -D \"$NEW\" -U myuser --no-instructions"
    su postgres -c "cd /tmp && pg_upgrade \
      --old-datadir=\"$OLD\" --new-datadir=\"$NEW\" \
      --old-bindir=/old_pg/usr_local/bin --new-bindir=/usr/local/bin \
      -U myuser --check"
    su postgres -c "cd /tmp && pg_upgrade \
      --old-datadir=\"$OLD\" --new-datadir=\"$NEW\" \
      --old-bindir=/old_pg/usr_local/bin --new-bindir=/usr/local/bin \
      -U myuser --link"
    rm -rf "$OLD" && mv "$NEW" "$OLD"
    grep -q "^host all all all" "$OLD/pg_hba.conf" || \
      printf "\nhost all all all scram-sha-256\n" >> "$OLD/pg_hba.conf"
  '

docker volume rm pg_old_bin
docker compose up -d postgres
```

---

## Dump / restore

Simpler when you do not want to stage old binaries; fine for small local databases.

```sh
docker compose down

# Start OLD image against existing volume
docker run --rm -d --name pg-old \
  -v directwerk_postgres_data:/var/lib/postgresql \
  -e POSTGRES_PASSWORD="$SPRING_DATASOURCE_PASSWORD" \
  -p 5433:5432 \
  postgres:OLD_TAG

docker exec pg-old pg_isready -U myuser -d mydatabase
docker exec pg-old pg_dumpall -U myuser > /tmp/directwerk-pg-backup.sql
docker stop pg-old

# Wipe old cluster files only (keep volume)
docker run --rm -v directwerk_postgres_data:/var/lib/postgresql alpine \
  rm -rf /var/lib/postgresql/19/docker

# Start NEW image (update compose tag first)
docker compose up -d postgres
docker compose exec -T postgres psql -U myuser -d postgres < /tmp/directwerk-pg-backup.sql
```

---

## Fresh start (local dev only)

Destroys all DB data. Flyway migrations and `LocalDevSeedRunner` / `DevDataInitializer` repopulate on next app start.

```sh
cd Directwerk
docker compose down -v
docker compose up -d
./gradlew :directwerk-app:bootRun
```

See [build-and-deploy.md](build-and-deploy.md) §1.2 and §3.

---

## Checklist for each version bump

1. Read [PostgreSQL release notes](https://www.postgresql.org/docs/current/release.html) for the target version.
2. Update image tags in **both**:
   - `Directwerk/docker-compose.yaml`
   - `docker-compose.full-stack.yaml` (monorepo root)
3. Stop stacks using the volume: `docker compose down` (and full-stack `down` if running).
4. Run `./scripts/postgres-upgrade.sh OLD_TAG NEW_TAG` (or dump/restore / `down -v`).
5. `docker compose up -d postgres` and verify:
   ```sh
   docker compose exec postgres psql -U myuser -d mydatabase -c "SELECT version();"
   ```
6. Run the API once (`bootRun` or stack) so Flyway can apply any pending migrations.

---

## Production note

PostgreSQL **beta** releases can change catalog format between betas. For production, plan upgrades on **GA** releases and test `pg_upgrade --check` on a copy of the volume first. Beta data paths and procedures match GA; only the image tags and catalog version checks differ.
