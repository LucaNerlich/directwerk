-- Custom (feed-builder) feeds reuse subscriber_feeds (is_default = false) and
-- select Formate via a tenant-scoped join table. Default feeds have zero rows.
ALTER TABLE subscriber_feeds
    ADD CONSTRAINT uq_subscriber_feeds_tenant_id UNIQUE (tenant_id, id);

CREATE UNIQUE INDEX uq_subscriber_feeds_custom_title
    ON subscriber_feeds (tenant_id, user_id, lower(title))
    WHERE is_default = FALSE;

CREATE TABLE subscriber_feed_formats (
    tenant_id BIGINT NOT NULL,
    feed_id   BIGINT NOT NULL,
    format_id BIGINT NOT NULL,
    PRIMARY KEY (feed_id, format_id),
    CONSTRAINT fk_subscriber_feed_formats_tenant_feed
        FOREIGN KEY (tenant_id, feed_id)
        REFERENCES subscriber_feeds (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_subscriber_feed_formats_tenant_format
        FOREIGN KEY (tenant_id, format_id)
        REFERENCES formats (tenant_id, id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_subscriber_feed_formats_format_id ON subscriber_feed_formats (format_id);

CREATE OR REPLACE FUNCTION sync_subscriber_feed_formats_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT sf.tenant_id INTO STRICT NEW.tenant_id
    FROM subscriber_feeds sf
    WHERE sf.id = NEW.feed_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscriber_feed_formats_tenant_id
    BEFORE INSERT OR UPDATE OF feed_id ON subscriber_feed_formats
    FOR EACH ROW
    EXECUTE FUNCTION sync_subscriber_feed_formats_tenant_id();
