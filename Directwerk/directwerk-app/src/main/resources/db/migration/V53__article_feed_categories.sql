-- Custom (feed-builder) article feeds reuse article_feeds (is_default = false) and
-- select Category via a tenant-scoped join table. Default feeds have zero rows.
-- Mirrors V44__subscriber_feed_formats.sql. categories(tenant_id, id) already has a unique
-- constraint (uq_categories_tenant_id, added by V33__create_articles.sql).

ALTER TABLE article_feeds
    ADD CONSTRAINT uq_article_feeds_tenant_id UNIQUE (tenant_id, id);

CREATE UNIQUE INDEX uq_article_feeds_custom_title
    ON article_feeds (tenant_id, user_id, lower(title))
    WHERE is_default = FALSE;

CREATE TABLE article_feed_categories (
    tenant_id   BIGINT NOT NULL,
    feed_id     BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    PRIMARY KEY (feed_id, category_id),
    CONSTRAINT fk_article_feed_categories_tenant_feed
        FOREIGN KEY (tenant_id, feed_id)
        REFERENCES article_feeds (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_article_feed_categories_tenant_category
        FOREIGN KEY (tenant_id, category_id)
        REFERENCES categories (tenant_id, id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_article_feed_categories_category_id ON article_feed_categories (category_id);

CREATE OR REPLACE FUNCTION sync_article_feed_categories_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT af.tenant_id INTO STRICT NEW.tenant_id
    FROM article_feeds af
    WHERE af.id = NEW.feed_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_article_feed_categories_tenant_id
    BEFORE INSERT OR UPDATE OF feed_id ON article_feed_categories
    FOR EACH ROW
    EXECUTE FUNCTION sync_article_feed_categories_tenant_id();
