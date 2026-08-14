CREATE TABLE product_access_rules (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES subscription_products(id) ON DELETE CASCADE,
    scope_type VARCHAR(32) NOT NULL,
    scope_id BIGINT,
    effect VARCHAR(16) NOT NULL DEFAULT 'GRANT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_product_access_rules_scope CHECK (scope_type IN (
        'ALL_PODCASTS','PODCAST_SERIES','FORMAT','CATEGORY','DIGITAL_ASSET','FEED_BUILDER'
    )),
    CONSTRAINT chk_product_access_rules_effect CHECK (effect = 'GRANT')
);

CREATE INDEX idx_product_access_rules_product ON product_access_rules(product_id);
CREATE INDEX idx_product_access_rules_tenant ON product_access_rules(tenant_id);
