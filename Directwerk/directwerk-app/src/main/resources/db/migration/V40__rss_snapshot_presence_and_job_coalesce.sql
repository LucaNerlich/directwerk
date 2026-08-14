-- Presence rows let feed HTTP 404 during cold start without HEADing S3.
-- Stale prefixes survive coalesced refresh jobs after a tenant slug change.

CREATE TABLE rss_snapshot_presence (
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    subject_id BIGINT NOT NULL,
    written_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (tenant_id, kind, subject_id),
    CONSTRAINT rss_snapshot_presence_kind_check
        CHECK (kind IN ('TENANT', 'SERIES', 'PRIVATE_FEED')),
    CONSTRAINT rss_snapshot_presence_subject_check
        CHECK (
            (kind = 'TENANT' AND subject_id = 0)
            OR (kind <> 'TENANT' AND subject_id > 0)
        )
);

CREATE TABLE rss_stale_prefixes (
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (tenant_id, slug),
    CONSTRAINT rss_stale_prefixes_slug_safe
        CHECK (btrim(slug) <> '' AND slug NOT LIKE '%/%' AND slug NOT LIKE '%..%')
);

-- Keep one QUEUED job per correlation so bursts do not stack full rebuilds.
-- PROCESSING jobs are excluded so a mutation during an in-flight rebuild still
-- enqueues a follow-up that reads the latest database state.
DELETE FROM jobs a
    USING jobs b
    WHERE a.ctid < b.ctid
      AND a.queue_name = b.queue_name
      AND a.correlation_id = b.correlation_id
      AND a.correlation_id IS NOT NULL
      AND a.status = 'QUEUED'
      AND b.status = 'QUEUED';

CREATE UNIQUE INDEX jobs_queued_correlation_uidx
    ON jobs (queue_name, correlation_id)
    WHERE status = 'QUEUED' AND correlation_id IS NOT NULL;
