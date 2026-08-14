-- flyway:executeInTransaction=false

ALTER TABLE jobs
    ADD COLUMN tenant_id BIGINT,
    ADD COLUMN correlation_id VARCHAR(200),
    ADD COLUMN metadata JSONB;

-- Add foreign key constraint with NOT VALID to avoid full table scan
-- Validation should be deferred to a later controlled migration
ALTER TABLE jobs
    ADD CONSTRAINT jobs_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) NOT VALID;

CREATE INDEX CONCURRENTLY jobs_tenant_list_idx
    ON jobs (tenant_id, queue_name, status, updated_at DESC, id)
    WHERE tenant_id IS NOT NULL;
