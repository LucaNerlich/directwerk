-- Tenant-scoped composite FKs for podcast content (mirrors V33 article pattern).
-- Nonblocking rollout: unique indexes via CONCURRENTLY, FKs added NOT VALID.
-- Optional refs use composite tenant FKs for write checks; BEFORE DELETE triggers
-- null only the reference column so tenant_id is preserved (PG has no SET NULL column-list).
-- flyway:executeInTransaction=false

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_podcast_series_tenant_id
    ON podcast_series (tenant_id, id);

ALTER TABLE podcast_series
    ADD CONSTRAINT uq_podcast_series_tenant_id UNIQUE USING INDEX uq_podcast_series_tenant_id;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_formats_tenant_id
    ON formats (tenant_id, id);

ALTER TABLE formats
    ADD CONSTRAINT uq_formats_tenant_id UNIQUE USING INDEX uq_formats_tenant_id;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_episodes_tenant_id
    ON episodes (tenant_id, id);

ALTER TABLE episodes
    ADD CONSTRAINT uq_episodes_tenant_id UNIQUE USING INDEX uq_episodes_tenant_id;

ALTER TABLE podcast_series
    DROP CONSTRAINT IF EXISTS podcast_series_cover_asset_id_fkey;

ALTER TABLE podcast_series
    ADD CONSTRAINT fk_podcast_series_tenant_cover_asset
        FOREIGN KEY (tenant_id, cover_asset_id)
        REFERENCES media_assets (tenant_id, id)
        NOT VALID;

ALTER TABLE categories
    DROP CONSTRAINT IF EXISTS categories_parent_id_fkey;

ALTER TABLE categories
    ADD CONSTRAINT fk_categories_tenant_parent
        FOREIGN KEY (tenant_id, parent_id)
        REFERENCES categories (tenant_id, id)
        NOT VALID;

ALTER TABLE episodes
    DROP CONSTRAINT IF EXISTS episodes_series_id_fkey;

ALTER TABLE episodes
    ADD CONSTRAINT fk_episodes_tenant_series
        FOREIGN KEY (tenant_id, series_id)
        REFERENCES podcast_series (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE episodes
    DROP CONSTRAINT IF EXISTS episodes_audio_asset_id_fkey;

ALTER TABLE episodes
    ADD CONSTRAINT fk_episodes_tenant_audio_asset
        FOREIGN KEY (tenant_id, audio_asset_id)
        REFERENCES media_assets (tenant_id, id)
        NOT VALID;

ALTER TABLE episode_formats
    ADD COLUMN IF NOT EXISTS tenant_id BIGINT;

UPDATE episode_formats ef
SET tenant_id = e.tenant_id
FROM episodes e
WHERE ef.episode_id = e.id
  AND ef.tenant_id IS NULL;

ALTER TABLE episode_formats
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE episode_formats
    DROP CONSTRAINT IF EXISTS episode_formats_episode_id_fkey;

ALTER TABLE episode_formats
    DROP CONSTRAINT IF EXISTS episode_formats_format_id_fkey;

ALTER TABLE episode_formats
    ADD CONSTRAINT fk_episode_formats_tenant_episode
        FOREIGN KEY (tenant_id, episode_id)
        REFERENCES episodes (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE episode_formats
    ADD CONSTRAINT fk_episode_formats_tenant_format
        FOREIGN KEY (tenant_id, format_id)
        REFERENCES formats (tenant_id, id)
        ON DELETE RESTRICT
        NOT VALID;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_episode_formats_tenant_id
    ON episode_formats (tenant_id);

ALTER TABLE episode_categories
    ADD COLUMN IF NOT EXISTS tenant_id BIGINT;

UPDATE episode_categories ec
SET tenant_id = e.tenant_id
FROM episodes e
WHERE ec.episode_id = e.id
  AND ec.tenant_id IS NULL;

ALTER TABLE episode_categories
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE episode_categories
    DROP CONSTRAINT IF EXISTS episode_categories_episode_id_fkey;

ALTER TABLE episode_categories
    DROP CONSTRAINT IF EXISTS episode_categories_category_id_fkey;

ALTER TABLE episode_categories
    ADD CONSTRAINT fk_episode_categories_tenant_episode
        FOREIGN KEY (tenant_id, episode_id)
        REFERENCES episodes (tenant_id, id)
        ON DELETE CASCADE
        NOT VALID;

ALTER TABLE episode_categories
    ADD CONSTRAINT fk_episode_categories_tenant_category
        FOREIGN KEY (tenant_id, category_id)
        REFERENCES categories (tenant_id, id)
        ON DELETE RESTRICT
        NOT VALID;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_episode_categories_tenant_id
    ON episode_categories (tenant_id);

CREATE OR REPLACE FUNCTION sync_episode_formats_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT e.tenant_id INTO STRICT NEW.tenant_id
    FROM episodes e
    WHERE e.id = NEW.episode_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_episode_formats_tenant_id ON episode_formats;
CREATE TRIGGER trg_episode_formats_tenant_id
    BEFORE INSERT OR UPDATE OF episode_id ON episode_formats
    FOR EACH ROW
    EXECUTE FUNCTION sync_episode_formats_tenant_id();

CREATE OR REPLACE FUNCTION sync_episode_categories_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT e.tenant_id INTO STRICT NEW.tenant_id
    FROM episodes e
    WHERE e.id = NEW.episode_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_episode_categories_tenant_id ON episode_categories;
CREATE TRIGGER trg_episode_categories_tenant_id
    BEFORE INSERT OR UPDATE OF episode_id ON episode_categories
    FOR EACH ROW
    EXECUTE FUNCTION sync_episode_categories_tenant_id();

ALTER TABLE media_assets
    ADD CONSTRAINT fk_media_assets_tenant_episode
        FOREIGN KEY (tenant_id, episode_id)
        REFERENCES episodes (tenant_id, id)
        NOT VALID;

-- Null only optional reference columns on parent delete (preserve tenant_id).
CREATE OR REPLACE FUNCTION null_optional_media_asset_refs()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE podcast_series
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

DROP TRIGGER IF EXISTS trg_media_assets_null_optional_refs ON media_assets;
CREATE TRIGGER trg_media_assets_null_optional_refs
    BEFORE DELETE ON media_assets
    FOR EACH ROW
    EXECUTE FUNCTION null_optional_media_asset_refs();

CREATE OR REPLACE FUNCTION null_category_parent_refs()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE categories
    SET parent_id = NULL
    WHERE parent_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_categories_null_parent_refs ON categories;
CREATE TRIGGER trg_categories_null_parent_refs
    BEFORE DELETE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION null_category_parent_refs();

CREATE OR REPLACE FUNCTION null_media_asset_episode_refs()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE media_assets
    SET episode_id = NULL
    WHERE episode_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_episodes_null_media_asset_refs ON episodes;
CREATE TRIGGER trg_episodes_null_media_asset_refs
    BEFORE DELETE ON episodes
    FOR EACH ROW
    EXECUTE FUNCTION null_media_asset_episode_refs();
