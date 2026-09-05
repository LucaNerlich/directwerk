-- Expand phase for feed bearer-token protection. Keep the original VARCHAR(64)
-- column in place so this deploy does not rewrite either feed table under an
-- ACCESS EXCLUSIVE ALTER COLUMN TYPE lock. The application moves to the wider
-- protected column; a later maintenance-window contract migration may remove
-- the legacy column after all deployments use it only as a hash mirror.
ALTER TABLE subscriber_feeds ADD COLUMN IF NOT EXISTS feed_token_hash VARCHAR(64);
ALTER TABLE subscriber_feeds ADD COLUMN IF NOT EXISTS feed_token_protected VARCHAR(255);

ALTER TABLE article_feeds ADD COLUMN IF NOT EXISTS feed_token_hash VARCHAR(64);
ALTER TABLE article_feeds ADD COLUMN IF NOT EXISTS feed_token_protected VARCHAR(255);
