-- Default cover images for podcast formats and episodes (RSS artwork fallback).
-- flyway:executeInTransaction=false

ALTER TABLE formats
    ADD COLUMN IF NOT EXISTS cover_asset_id BIGINT;

ALTER TABLE episodes
    ADD COLUMN IF NOT EXISTS cover_asset_id BIGINT;

ALTER TABLE formats
    DROP CONSTRAINT IF EXISTS formats_cover_asset_id_fkey;

ALTER TABLE formats
    ADD CONSTRAINT fk_formats_tenant_cover_asset
        FOREIGN KEY (tenant_id, cover_asset_id)
        REFERENCES media_assets (tenant_id, id)
        NOT VALID;

ALTER TABLE episodes
    DROP CONSTRAINT IF EXISTS episodes_cover_asset_id_fkey;

ALTER TABLE episodes
    ADD CONSTRAINT fk_episodes_tenant_cover_asset
        FOREIGN KEY (tenant_id, cover_asset_id)
        REFERENCES media_assets (tenant_id, id)
        NOT VALID;

CREATE OR REPLACE FUNCTION null_optional_media_asset_refs()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE podcast_series
    SET cover_asset_id = NULL
    WHERE cover_asset_id = OLD.id;

    UPDATE formats
    SET cover_asset_id = NULL
    WHERE cover_asset_id = OLD.id;

    UPDATE episodes
    SET cover_asset_id = NULL
    WHERE cover_asset_id = OLD.id;

    UPDATE episodes
    SET audio_asset_id = NULL
    WHERE audio_asset_id = OLD.id;

    UPDATE articles
    SET hero_asset_id = NULL
    WHERE hero_asset_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
