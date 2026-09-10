-- Make the podcast RSS bulk-import queue explicit now that article imports use a sibling queue.
-- Only producer-generated correlation ids are renamed. Custom ids remain unchanged so a valid
-- 200-character historical value cannot overflow the correlation_id column.
UPDATE jobs
SET queue_name = 'podcast-rss-bulk-import',
    correlation_id = CASE
        WHEN correlation_id LIKE 'rss-bulk-import-%'
            THEN 'podcast-' || correlation_id
        ELSE correlation_id
    END
WHERE queue_name = 'rss-bulk-import';
