-- Domain ownership verification columns + verified-host lookup index
-- flyway:executeInTransaction=false

ALTER TABLE tenant_domains
    ADD COLUMN IF NOT EXISTS verification_token TEXT CHECK (LENGTH(verification_token) <= 64),
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

UPDATE tenant_domains
SET verified_at = COALESCE(verified_at, created_at)
WHERE verified = TRUE
  AND verified_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_domains_verified_host
    ON tenant_domains (LOWER(host))
    WHERE verified = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_memberships_tenant_user
    ON tenant_memberships (tenant_id, user_id);
