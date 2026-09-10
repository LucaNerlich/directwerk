-- flyway:executeInTransaction=false

-- Stable per-feed RSS item identity so one feed can be retried without colliding
-- with another feed that happens to use the same GUID.
ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS import_identity VARCHAR(64);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_articles_tenant_import_identity
    ON articles (tenant_id, import_identity)
    WHERE import_identity IS NOT NULL;
