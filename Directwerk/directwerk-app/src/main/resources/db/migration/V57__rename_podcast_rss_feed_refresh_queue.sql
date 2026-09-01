-- Make the podcast RSS queue explicit now that article RSS refreshes use a separate queue.
-- Only producer-generated correlation ids are renamed. Custom ids remain unchanged so a valid
-- 200-character historical value cannot overflow the correlation_id column.
UPDATE jobs
SET queue_name = 'podcast-rss-feed-refresh',
    correlation_id = CASE
        WHEN tenant_id IS NOT NULL
            AND correlation_id = 'rss-feed-refresh-' || tenant_id::text
            THEN 'podcast-rss-feed-refresh-' || tenant_id::text
        ELSE correlation_id
    END
WHERE queue_name = 'rss-feed-refresh';
