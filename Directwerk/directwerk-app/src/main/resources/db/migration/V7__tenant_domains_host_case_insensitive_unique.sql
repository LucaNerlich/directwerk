ALTER TABLE tenant_domains
    DROP CONSTRAINT IF EXISTS uq_tenant_domains_host;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_domains_host ON tenant_domains (LOWER(host));
