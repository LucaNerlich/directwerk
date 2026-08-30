ALTER TABLE media_assets
    ADD COLUMN import_source_url VARCHAR(2048);

CREATE INDEX idx_media_assets_tenant_import_source
    ON media_assets (tenant_id, import_source_url)
    WHERE import_source_url IS NOT NULL;

COMMENT ON COLUMN media_assets.import_source_url IS
    'Canonical remote import URL used to reuse already ingested assets (e.g. shared RSS cover art).';
