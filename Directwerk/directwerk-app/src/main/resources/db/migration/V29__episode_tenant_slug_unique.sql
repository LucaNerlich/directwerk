ALTER TABLE episodes DROP CONSTRAINT IF EXISTS uq_episodes_series_slug;
ALTER TABLE episodes ADD CONSTRAINT uq_episodes_tenant_slug UNIQUE (tenant_id, slug);
