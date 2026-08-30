ALTER TABLE media_assets
    ADD COLUMN bytes_transferred BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN media_assets.bytes_transferred IS
    'Bytes streamed so far for PENDING remote-ingest assets; reset to final size on READY.';
