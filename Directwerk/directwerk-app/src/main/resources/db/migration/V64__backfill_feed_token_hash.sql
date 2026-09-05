-- Backfill the V63 blind-index column from existing raw bearer tokens using
-- PostgreSQL's built-in sha256(bytea) (no extension needed).
-- feed_token values stay untouched here: legacy rows keep their raw token until
-- the next rotation encrypts them (FeedTokenProtector.reveal passes unprefixed
-- values through), while lookups already match on the hash for old and new rows.
UPDATE subscriber_feeds
SET feed_token_hash = encode(sha256(convert_to(feed_token, 'UTF8')), 'hex')
WHERE feed_token_hash IS NULL;

UPDATE article_feeds
SET feed_token_hash = encode(sha256(convert_to(feed_token, 'UTF8')), 'hex')
WHERE feed_token_hash IS NULL;
