-- Allow queued deletion state used by MediaAssetLifecycleService
ALTER TABLE media_assets DROP CONSTRAINT chk_media_assets_status;

ALTER TABLE media_assets
    ADD CONSTRAINT chk_media_assets_status
        CHECK (status IN ('PENDING', 'READY', 'PENDING_DELETE', 'ARCHIVED'));
