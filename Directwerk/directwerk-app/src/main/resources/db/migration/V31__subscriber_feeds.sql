CREATE TABLE subscriber_feeds (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_token VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subscriber_feeds_token UNIQUE (feed_token)
);

CREATE UNIQUE INDEX uq_subscriber_feeds_default
    ON subscriber_feeds(tenant_id, user_id)
    WHERE is_default = TRUE;
CREATE INDEX idx_subscriber_feeds_tenant_user ON subscriber_feeds(tenant_id, user_id);
