CREATE TABLE feature_modules (
    id              BIGSERIAL PRIMARY KEY,
    module_key      VARCHAR(64)  NOT NULL,
    name            VARCHAR(128) NOT NULL,
    description     TEXT,
    depends_on      JSONB        NOT NULL DEFAULT '[]',
    is_core         BOOLEAN      NOT NULL DEFAULT FALSE,
    platform_active BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_feature_modules_key UNIQUE (module_key)
);

CREATE TABLE tenant_module_activations (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_key      VARCHAR(64)  NOT NULL,
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    activated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    source          VARCHAR(32)  NOT NULL DEFAULT 'MANUAL',
    CONSTRAINT uq_tenant_module UNIQUE (tenant_id, module_key),
    CONSTRAINT fk_tenant_module_activations_module_key
        FOREIGN KEY (module_key) REFERENCES feature_modules(module_key) ON DELETE RESTRICT
);

CREATE INDEX idx_tenant_module_activations_tenant_id ON tenant_module_activations(tenant_id);
CREATE INDEX idx_tenant_module_activations_module_key ON tenant_module_activations(module_key);
CREATE INDEX idx_tenant_module_activations_tenant_active ON tenant_module_activations(tenant_id) WHERE active = TRUE;

INSERT INTO feature_modules (module_key, name, depends_on, is_core, platform_active) VALUES
    ('DIGITAL_CONTENT', 'Digital Content', '[]', TRUE, TRUE),
    ('PODCAST', 'Podcast', '["DIGITAL_CONTENT"]', FALSE, TRUE),
    ('PODCAST_RSS', 'Podcast RSS', '["PODCAST"]', FALSE, TRUE),
    ('SUBSCRIPTION', 'Subscriptions', '["DIGITAL_CONTENT"]', FALSE, TRUE),
    ('FEED_BUILDER', 'Feed Builder', '["PODCAST_RSS", "SUBSCRIPTION"]', FALSE, TRUE),
    ('STRIPE_BILLING', 'Stripe Billing', '["SUBSCRIPTION"]', FALSE, TRUE),
    ('PATREON_SYNC', 'Patreon Sync', '["SUBSCRIPTION"]', FALSE, TRUE),
    ('STEADY_SYNC', 'Steady Sync', '["SUBSCRIPTION"]', FALSE, TRUE),
    ('WHITELABEL', 'Whitelabel', '[]', FALSE, TRUE),
    ('ANALYTICS', 'Analytics', '["DIGITAL_CONTENT"]', FALSE, FALSE),
    ('EMAIL_NOTIFY', 'Email Notifications', '["PODCAST_RSS", "SUBSCRIPTION"]', FALSE, FALSE);
