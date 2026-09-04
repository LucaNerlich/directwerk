-- Creator tracking for the RBAC permission model (issue #148).
-- NULL means legacy rows (treated as not-owned: tenant admins can still act).
ALTER TABLE episodes ADD COLUMN created_by BIGINT;
ALTER TABLE podcast_series ADD COLUMN created_by BIGINT;
ALTER TABLE articles ADD COLUMN created_by BIGINT;
ALTER TABLE media_assets ADD COLUMN created_by BIGINT;
ALTER TABLE media_folders ADD COLUMN created_by BIGINT;

CREATE INDEX idx_episodes_created_by ON episodes(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_podcast_series_created_by ON podcast_series(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_articles_created_by ON articles(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_media_assets_created_by ON media_assets(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_media_folders_created_by ON media_folders(created_by) WHERE created_by IS NOT NULL;
