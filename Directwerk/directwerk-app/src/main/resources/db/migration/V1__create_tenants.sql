CREATE TABLE tenants (
    id              BIGSERIAL PRIMARY KEY,
    slug            VARCHAR(64)  NOT NULL,
    name            VARCHAR(255) NOT NULL,
    status          VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenants_slug UNIQUE (slug),
    CONSTRAINT tenants_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED'))
);

CREATE TABLE tenant_domains (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    host            VARCHAR(255) NOT NULL,
    verified        BOOLEAN      NOT NULL DEFAULT FALSE,
    is_primary      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_tenant_domains_host ON tenant_domains (LOWER(host));

CREATE INDEX idx_tenant_domains_tenant_id ON tenant_domains(tenant_id);

CREATE TABLE tenant_branding (
    tenant_id       BIGINT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    logo_url        VARCHAR(512),
    primary_color   VARCHAR(7),
    secondary_color VARCHAR(7),
    site_title      VARCHAR(255),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
