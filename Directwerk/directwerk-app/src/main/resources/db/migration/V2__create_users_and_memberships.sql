CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255),
    name            VARCHAR(255),
    status          VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_status_check CHECK (status IN ('ACTIVE', 'PENDING_VERIFICATION', 'DISABLED'))
);

CREATE TABLE tenant_memberships (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id),
    roles           JSONB NOT NULL DEFAULT '["SUBSCRIBER"]',
    status          VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    invited_at      TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tenant_id),
    CONSTRAINT tm_status_check CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED'))
);

CREATE INDEX idx_tenant_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX idx_tenant_memberships_user ON tenant_memberships(user_id);
CREATE INDEX idx_tenant_memberships_status ON tenant_memberships(status);
CREATE INDEX idx_tenant_memberships_tenant_status ON tenant_memberships(tenant_id, status);

CREATE INDEX idx_users_status ON users(status);
CREATE UNIQUE INDEX uq_users_email ON users (LOWER(email));

CREATE TABLE platform_admins (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL UNIQUE REFERENCES users(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by      BIGINT REFERENCES users(id)
);

CREATE TABLE password_reset_tokens (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    token_hash      VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE UNIQUE INDEX uq_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
