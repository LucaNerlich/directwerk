-- Alpha storage foundation: media asset metadata (bytes live in S3)
CREATE TABLE media_assets (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    s3_key          VARCHAR(512) NOT NULL,
    visibility      VARCHAR(16) NOT NULL,
    scope           VARCHAR(32) NOT NULL,
    asset_type      VARCHAR(16) NOT NULL,
    status          VARCHAR(16) NOT NULL,
    owner_user_id   BIGINT,
    episode_id      BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_media_assets_tenant_s3_key UNIQUE (tenant_id, s3_key),
    CONSTRAINT chk_media_assets_visibility CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
    CONSTRAINT chk_media_assets_scope CHECK (scope IN ('TENANT_PUBLIC', 'CONTENT', 'USER', 'SYSTEM')),
    CONSTRAINT chk_media_assets_asset_type CHECK (asset_type IN ('AUDIO', 'IMAGE', 'VIDEO', 'DOCUMENT')),
    CONSTRAINT chk_media_assets_status CHECK (status IN ('PENDING', 'READY', 'ARCHIVED'))
);

CREATE INDEX idx_media_assets_tenant_id ON media_assets(tenant_id);
CREATE INDEX idx_media_assets_episode_id ON media_assets(episode_id) WHERE episode_id IS NOT NULL;
