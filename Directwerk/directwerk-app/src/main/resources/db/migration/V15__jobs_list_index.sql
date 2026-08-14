-- flyway:executeInTransaction=false
-- Supports operational list/filter by queue, status, and recency.
CREATE INDEX CONCURRENTLY jobs_list_idx
    ON jobs (queue_name, status, updated_at DESC, id);
