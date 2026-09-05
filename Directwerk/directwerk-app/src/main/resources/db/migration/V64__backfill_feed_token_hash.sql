-- Backfill the V63 blind-index column from existing raw bearer tokens using
-- PostgreSQL's built-in sha256(bytea) (no extension needed).
-- Copy legacy clear tokens to the expanded protected column. FeedTokenProtector
-- accepts these unprefixed values until their next rotation encrypts them.
UPDATE subscriber_feeds
SET feed_token_protected = COALESCE(feed_token_protected, feed_token),
    feed_token_hash = COALESCE(
        feed_token_hash,
        encode(sha256(convert_to(feed_token, 'UTF8')), 'hex')
    )
WHERE feed_token_protected IS NULL OR feed_token_hash IS NULL;

UPDATE article_feeds
SET feed_token_protected = COALESCE(feed_token_protected, feed_token),
    feed_token_hash = COALESCE(
        feed_token_hash,
        encode(sha256(convert_to(feed_token, 'UTF8')), 'hex')
    )
WHERE feed_token_protected IS NULL OR feed_token_hash IS NULL;

-- Remove clear bearer tokens from the legacy columns without dropping their
-- existing unique constraints. New application writes mirror the blind index
-- here until a controlled contract migration removes the columns.
UPDATE subscriber_feeds SET feed_token = feed_token_hash;
UPDATE article_feeds SET feed_token = feed_token_hash;
