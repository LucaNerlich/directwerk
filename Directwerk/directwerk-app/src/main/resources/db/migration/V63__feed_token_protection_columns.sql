-- Feed bearer tokens at rest: AES-256-GCM ciphertext in feed_token (see
-- FeedTokenProtector) with a SHA-256 blind index for lookups. V64 backfills
-- existing rows; V65 enforces NOT NULL + uniqueness on the hash columns.
ALTER TABLE subscriber_feeds ADD COLUMN IF NOT EXISTS feed_token_hash VARCHAR(64);
ALTER TABLE subscriber_feeds ALTER COLUMN feed_token TYPE VARCHAR(255);
ALTER TABLE subscriber_feeds DROP CONSTRAINT IF EXISTS uq_subscriber_feeds_token;

ALTER TABLE article_feeds ADD COLUMN IF NOT EXISTS feed_token_hash VARCHAR(64);
ALTER TABLE article_feeds ALTER COLUMN feed_token TYPE VARCHAR(255);
ALTER TABLE article_feeds DROP CONSTRAINT IF EXISTS uq_article_feeds_token;
