-- Media upload metadata for Phase 2c (mime/size/filename on MediaAsset)
ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS mime_type VARCHAR(128),
    ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
    ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255);
