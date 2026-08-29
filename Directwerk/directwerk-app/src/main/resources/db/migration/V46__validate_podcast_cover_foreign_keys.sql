-- Validate tenant-scoped cover FKs added NOT VALID in V45.
-- flyway:executeInTransaction=false

ALTER TABLE formats VALIDATE CONSTRAINT fk_formats_tenant_cover_asset;
ALTER TABLE episodes VALIDATE CONSTRAINT fk_episodes_tenant_cover_asset;
