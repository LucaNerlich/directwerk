-- Validate tenant-scoped podcast FKs added NOT VALID in V35 (separate deploy step).
-- flyway:executeInTransaction=false

ALTER TABLE podcast_series VALIDATE CONSTRAINT fk_podcast_series_tenant_cover_asset;

ALTER TABLE categories VALIDATE CONSTRAINT fk_categories_tenant_parent;

ALTER TABLE episodes VALIDATE CONSTRAINT fk_episodes_tenant_series;
ALTER TABLE episodes VALIDATE CONSTRAINT fk_episodes_tenant_audio_asset;

ALTER TABLE episode_formats VALIDATE CONSTRAINT fk_episode_formats_tenant_episode;
ALTER TABLE episode_formats VALIDATE CONSTRAINT fk_episode_formats_tenant_format;

ALTER TABLE episode_categories VALIDATE CONSTRAINT fk_episode_categories_tenant_episode;
ALTER TABLE episode_categories VALIDATE CONSTRAINT fk_episode_categories_tenant_category;

ALTER TABLE media_assets VALIDATE CONSTRAINT fk_media_assets_tenant_episode;
