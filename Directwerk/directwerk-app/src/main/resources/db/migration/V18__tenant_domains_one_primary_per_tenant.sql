-- flyway:executeInTransaction=false
-- Enforce at most one primary domain per tenant at the database level.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY id) AS rn
    FROM tenant_domains
    WHERE is_primary = TRUE
)
UPDATE tenant_domains td
SET is_primary = FALSE
FROM ranked r
WHERE td.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_tenant_domains_one_primary_per_tenant__new
    ON tenant_domains (tenant_id)
    WHERE is_primary = TRUE;

DROP INDEX CONCURRENTLY IF EXISTS uq_tenant_domains_one_primary_per_tenant;

ALTER INDEX uq_tenant_domains_one_primary_per_tenant__new
    RENAME TO uq_tenant_domains_one_primary_per_tenant;
