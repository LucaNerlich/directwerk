-- flyway:executeInTransaction=false
-- Speeds periodic deletion of terminal rows by updated_at (COMPLETED / FAILED).
DROP INDEX CONCURRENTLY IF EXISTS jobs_terminal_cleanup_idx;
CREATE INDEX CONCURRENTLY jobs_terminal_cleanup_idx
    ON jobs (updated_at, id)
    WHERE status IN ('COMPLETED', 'FAILED');
