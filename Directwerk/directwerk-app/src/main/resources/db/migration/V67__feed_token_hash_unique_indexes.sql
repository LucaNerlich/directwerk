-- flyway:executeInTransaction=false
-- Build uniqueness without taking a table-wide write lock for the index scan.
CREATE UNIQUE INDEX CONCURRENTLY uq_subscriber_feeds_token_hash
    ON subscriber_feeds (feed_token_hash);
CREATE UNIQUE INDEX CONCURRENTLY uq_article_feeds_token_hash
    ON article_feeds (feed_token_hash);
