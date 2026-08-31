-- Mirrors V31__subscriber_feeds.sql for articles: one default public feed exists implicitly
-- (no row — served straight from published articles), one default private per-user feed
-- (is_default = true), and N feed-builder custom feeds (is_default = false).

CREATE TABLE article_feeds (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_token    VARCHAR(64) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    is_default    BOOLEAN NOT NULL DEFAULT TRUE,
    enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_article_feeds_token UNIQUE (feed_token)
);

CREATE UNIQUE INDEX uq_article_feeds_default
    ON article_feeds (tenant_id, user_id)
    WHERE is_default = TRUE;

CREATE INDEX idx_article_feeds_tenant_user ON article_feeds (tenant_id, user_id);
