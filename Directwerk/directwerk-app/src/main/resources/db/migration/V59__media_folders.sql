-- User-facing folders for the media library (issue #146).
--
-- Folders are pure organization metadata: asset S3 keys stay flat and immutable,
-- moving an asset or folder is a single UPDATE on folder_id/parent_id — no S3
-- copies, no CDN invalidation. A NULL folder_id/parent_id means the library root.
CREATE TABLE media_folders (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id BIGINT,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_media_folders_tenant_id_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_media_folders_tenant_parent
        FOREIGN KEY (tenant_id, parent_id)
        REFERENCES media_folders(tenant_id, id)
        ON DELETE SET NULL (parent_id),
    CONSTRAINT chk_media_folders_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

-- Folder names are unique per parent (NULL parent = library root). Postgres treats
-- NULL as distinct, so root and nested scopes need separate partial indexes.
CREATE UNIQUE INDEX uq_media_folders_root_name
    ON media_folders(tenant_id, name) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX uq_media_folders_child_name
    ON media_folders(tenant_id, parent_id, name) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_media_folders_tenant_id ON media_folders(tenant_id);
CREATE INDEX idx_media_folders_parent_id ON media_folders(parent_id) WHERE parent_id IS NOT NULL;

-- Deleting a folder row with ON DELETE SET NULL keeps orphaned assets readable at
-- the root; the service deletes explicitly (move-up or recursive) beforehand.
ALTER TABLE media_assets
    ADD COLUMN folder_id BIGINT,
    ADD CONSTRAINT fk_media_assets_tenant_folder
        FOREIGN KEY (tenant_id, folder_id)
        REFERENCES media_folders(tenant_id, id)
        ON DELETE SET NULL (folder_id);
CREATE INDEX idx_media_assets_folder_id ON media_assets(folder_id) WHERE folder_id IS NOT NULL;
