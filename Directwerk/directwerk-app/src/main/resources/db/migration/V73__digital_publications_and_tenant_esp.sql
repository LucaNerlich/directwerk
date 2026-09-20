-- Bonus DigitalPublication desk + optional per-tenant ESP (Mailgun) connection.

CREATE TABLE digital_publications (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug                        VARCHAR(64) NOT NULL,
    title                       VARCHAR(255) NOT NULL,
    description                 TEXT,
    asset_id                    BIGINT NOT NULL REFERENCES media_assets(id),
    access_policy               VARCHAR(16) NOT NULL DEFAULT 'FREE',
    required_level_sort_order   INT,
    status                      VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    published_at                TIMESTAMPTZ,
    created_by                  BIGINT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_digital_publications_tenant_slug UNIQUE (tenant_id, slug),
    CONSTRAINT chk_digital_publications_access_policy CHECK (access_policy IN ('FREE', 'PAID')),
    CONSTRAINT chk_digital_publications_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT chk_digital_publications_required_level CHECK (
        required_level_sort_order IS NULL OR required_level_sort_order >= 0
    )
);

CREATE INDEX idx_digital_publications_tenant_status
    ON digital_publications (tenant_id, status);

CREATE INDEX idx_digital_publications_tenant_asset
    ON digital_publications (tenant_id, asset_id);

CREATE TABLE tenant_esp_connections (
    id                      BIGSERIAL PRIMARY KEY,
    tenant_id               BIGINT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    provider                VARCHAR(32) NOT NULL,
    domain                  VARCHAR(255) NOT NULL,
    from_email              VARCHAR(320) NOT NULL,
    from_name               VARCHAR(255),
    region                  VARCHAR(8) NOT NULL DEFAULT 'EU',
    api_key_ciphertext      TEXT NOT NULL,
    status                  VARCHAR(16) NOT NULL DEFAULT 'CONNECTED',
    connected_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_tenant_esp_provider CHECK (provider IN ('MAILGUN')),
    CONSTRAINT chk_tenant_esp_region CHECK (region IN ('EU', 'US')),
    CONSTRAINT chk_tenant_esp_status CHECK (status IN ('CONNECTED', 'DISABLED'))
);
