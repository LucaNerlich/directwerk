-- Per-tenant media upload size overrides (issue: upload limits per tenant).
--
-- NULL means "platform default" (see MediaUploadRules); a non-NULL value caps
-- uploads of that asset type for the tenant. Bounds are enforced by the API
-- (1 byte .. 5 GiB single-PUT ceiling); the CHECK below only guards the sign.
ALTER TABLE tenants
    ADD COLUMN max_audio_bytes BIGINT,
    ADD COLUMN max_image_bytes BIGINT,
    ADD COLUMN max_video_bytes BIGINT,
    ADD COLUMN max_document_bytes BIGINT,
    ADD CONSTRAINT chk_tenants_upload_limits_positive CHECK (
        (max_audio_bytes IS NULL OR max_audio_bytes > 0)
        AND (max_image_bytes IS NULL OR max_image_bytes > 0)
        AND (max_video_bytes IS NULL OR max_video_bytes > 0)
        AND (max_document_bytes IS NULL OR max_document_bytes > 0)
    ) NOT VALID;
