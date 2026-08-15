-- Correlation-id dedup must be scoped to the tenant: the previous index keyed only on
-- (queue_name, correlation_id), so two tenants emitting the same correlation id on the same
-- queue coalesced into one job and the second tenant's work was silently dropped.

DROP INDEX IF EXISTS jobs_queued_correlation_uidx;

CREATE UNIQUE INDEX jobs_queued_correlation_uidx
    ON jobs (queue_name, correlation_id, tenant_id)
    WHERE status = 'QUEUED' AND correlation_id IS NOT NULL;
