-- Import rollback must prove ownership of the exact ingest attempt. User identity is not a
-- cleanup capability and cannot distinguish a newly-created asset from a reused one.
ALTER TABLE media_assets
    ADD COLUMN ingest_cleanup_token UUID;
