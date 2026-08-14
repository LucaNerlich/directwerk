-- Directwerk — local PostgreSQL bootstrap (PostgreSQL 18/19)
--
-- Creates the application role and database expected by compose.yaml, .env.example,
-- and ./gradlew flywayMigrate. Flyway and the Spring app create all tables on startup.
--
-- Requires SPRING_DATASOURCE_PASSWORD in the environment (load .env first):
--
--   set -a && source .env && set +a
--   psql -U postgres -f scripts/setup-local-database.sql
--
-- Defaults:
--   database : mydatabase
--   role     : myuser
--
-- After this script, start the app or run:
--   ./gradlew flywayMigrate
--   ./gradlew bootRun --args='--spring.profiles.active=local'
--
-- Docker Compose publishes Postgres on DIRECTWERK_POSTGRES_PORT (default 5433).

\set ON_ERROR_STOP on

\getenv db_password SPRING_DATASOURCE_PASSWORD

\if :{?db_password}
\else
\echo 'ERROR: Export SPRING_DATASOURCE_PASSWORD before running this script (set -a && source .env && set +a).'
\quit 1
\endif

SELECT CASE
    WHEN length(:'db_password') = 0
    THEN 'DO $r$ BEGIN RAISE EXCEPTION ''SPRING_DATASOURCE_PASSWORD must not be empty''; END $r$'
    ELSE 'SELECT 1'
END AS cmd
\gexec

-- 1) Application role (create or reset password to match SPRING_DATASOURCE_PASSWORD)
SELECT CASE
    WHEN EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = 'myuser'
    )
    THEN format('ALTER ROLE myuser WITH LOGIN PASSWORD %L', :'db_password')
    ELSE format('CREATE ROLE myuser WITH LOGIN PASSWORD %L', :'db_password')
END AS cmd
\gexec

-- 2) Application database
-- NOTE: CREATE DATABASE cannot run inside a transaction; skip manually if it already exists.
CREATE DATABASE mydatabase
    OWNER myuser
    ENCODING 'UTF8'
    TEMPLATE template0;

-- 3) Schema privileges (PostgreSQL 15+ no longer grants CREATE on public by default)
\connect mydatabase

GRANT CONNECT ON DATABASE mydatabase TO myuser;
GRANT USAGE, CREATE ON SCHEMA public TO myuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO myuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO myuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO myuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO myuser;
