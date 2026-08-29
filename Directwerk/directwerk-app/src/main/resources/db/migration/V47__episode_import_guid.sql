-- Stable RSS item identity so a feed can be imported more than once without duplicates.
ALTER TABLE episodes
    ADD COLUMN IF NOT EXISTS import_guid VARCHAR(512);

CREATE UNIQUE INDEX IF NOT EXISTS uq_episodes_tenant_import_guid
    ON episodes (tenant_id, import_guid)
    WHERE import_guid IS NOT NULL;
