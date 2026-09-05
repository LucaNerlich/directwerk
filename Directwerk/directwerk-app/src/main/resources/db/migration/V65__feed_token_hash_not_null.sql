-- Enforce the V64 backfill: every feed row carries a blind index from here on.
-- (If V64 left NULLs behind it failed first, so these statements only harden.)
ALTER TABLE subscriber_feeds ALTER COLUMN feed_token_hash SET NOT NULL;
ALTER TABLE subscriber_feeds ADD CONSTRAINT uq_subscriber_feeds_token_hash UNIQUE (feed_token_hash);

ALTER TABLE article_feeds ALTER COLUMN feed_token_hash SET NOT NULL;
ALTER TABLE article_feeds ADD CONSTRAINT uq_article_feeds_token_hash UNIQUE (feed_token_hash);
