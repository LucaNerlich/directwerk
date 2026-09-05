-- Attach the already-built indexes as constraints. The validated CHECK
-- constraints remain the deployed non-null invariant; SET NOT NULL is deferred
-- to a separately scheduled maintenance-window contract migration.
ALTER TABLE subscriber_feeds
    ADD CONSTRAINT uq_subscriber_feeds_token_hash
    UNIQUE USING INDEX uq_subscriber_feeds_token_hash;

ALTER TABLE article_feeds
    ADD CONSTRAINT uq_article_feeds_token_hash
    UNIQUE USING INDEX uq_article_feeds_token_hash;
