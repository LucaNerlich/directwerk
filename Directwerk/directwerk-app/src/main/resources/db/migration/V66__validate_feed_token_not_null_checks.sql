-- Validate separately so PostgreSQL scans without blocking normal reads/writes.
ALTER TABLE subscriber_feeds
    VALIDATE CONSTRAINT chk_subscriber_feeds_token_hash_not_null;
ALTER TABLE subscriber_feeds
    VALIDATE CONSTRAINT chk_subscriber_feeds_token_protected_not_null;

ALTER TABLE article_feeds
    VALIDATE CONSTRAINT chk_article_feeds_token_hash_not_null;
ALTER TABLE article_feeds
    VALIDATE CONSTRAINT chk_article_feeds_token_protected_not_null;
