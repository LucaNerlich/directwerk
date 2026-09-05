-- Add non-null invariants without scanning either feed table while holding the
-- stronger lock required by SET NOT NULL. Validation follows in V66.
ALTER TABLE subscriber_feeds
    ADD CONSTRAINT chk_subscriber_feeds_token_hash_not_null
    CHECK (feed_token_hash IS NOT NULL) NOT VALID,
    ADD CONSTRAINT chk_subscriber_feeds_token_protected_not_null
    CHECK (feed_token_protected IS NOT NULL) NOT VALID;

ALTER TABLE article_feeds
    ADD CONSTRAINT chk_article_feeds_token_hash_not_null
    CHECK (feed_token_hash IS NOT NULL) NOT VALID,
    ADD CONSTRAINT chk_article_feeds_token_protected_not_null
    CHECK (feed_token_protected IS NOT NULL) NOT VALID;
