CREATE TABLE subscription_products (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug            VARCHAR(64) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    offering_type   VARCHAR(16) NOT NULL DEFAULT 'LEVEL',
    sort_order      INT NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT subscription_products_offering_type_check CHECK (offering_type IN ('LEVEL', 'PACKAGE')),
    UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_subscription_products_tenant ON subscription_products(tenant_id);
CREATE INDEX idx_subscription_products_tenant_active ON subscription_products(tenant_id, active);

CREATE TABLE subscriptions (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id      BIGINT NOT NULL REFERENCES subscription_products(id) ON DELETE RESTRICT,
    status          VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    source          VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id, product_id),
    CONSTRAINT subscriptions_status_check CHECK (status IN ('ACTIVE', 'CANCELED', 'EXPIRED')),
    CONSTRAINT subscriptions_source_check CHECK (source IN ('MANUAL', 'SEED', 'STRIPE', 'PATREON', 'IMPORT'))
);

CREATE INDEX idx_subscriptions_tenant_user ON subscriptions(tenant_id, user_id);
CREATE INDEX idx_subscriptions_tenant_user_status ON subscriptions(tenant_id, user_id, status);
CREATE INDEX idx_subscriptions_product ON subscriptions(product_id);
