-- Inbound tenant API keys (opaque Bearer secrets for MCP / integrators).
-- Raw secret is shown once at create time; only SHA-256 hex is stored.

CREATE TABLE tenant_api_keys (
    id                   BIGSERIAL PRIMARY KEY,
    tenant_id            BIGINT NOT NULL REFERENCES tenants(id),
    name                 VARCHAR(100) NOT NULL,
    prefix               VARCHAR(16) NOT NULL,
    token_hash           VARCHAR(64) NOT NULL,
    scopes               JSONB NOT NULL,
    created_by_user_id   BIGINT NOT NULL REFERENCES users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at         TIMESTAMPTZ,
    expires_at           TIMESTAMPTZ,
    revoked_at           TIMESTAMPTZ,
    CONSTRAINT uq_tenant_api_keys_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_tenant_api_keys_token_hash UNIQUE (token_hash),
    CONSTRAINT chk_tenant_api_keys_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT chk_tenant_api_keys_prefix_not_blank CHECK (char_length(btrim(prefix)) > 0)
);

CREATE INDEX idx_tenant_api_keys_tenant_id ON tenant_api_keys(tenant_id);
CREATE INDEX idx_tenant_api_keys_tenant_active
    ON tenant_api_keys(tenant_id)
    WHERE revoked_at IS NULL;
