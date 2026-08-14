CREATE TYPE job_status AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name      VARCHAR(100) NOT NULL,
    payload         JSONB NOT NULL,
    priority        INTEGER NOT NULL DEFAULT 0,
    status          job_status NOT NULL DEFAULT 'QUEUED',
    available_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 3,
    locked_by       VARCHAR(200),
    locked_until    TIMESTAMPTZ,
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT jobs_queue_not_blank CHECK (btrim(queue_name) <> ''),
    CONSTRAINT jobs_attempts_valid CHECK (
        attempts >= 0 AND max_attempts > 0 AND attempts <= max_attempts
    ),
    CONSTRAINT jobs_lease_consistent CHECK (
        (status = 'PROCESSING' AND locked_by IS NOT NULL AND locked_until IS NOT NULL)
        OR (status <> 'PROCESSING' AND locked_by IS NULL AND locked_until IS NULL)
    )
);

CREATE INDEX jobs_claim_idx
    ON jobs (queue_name, priority DESC, available_at, id)
    WHERE status = 'QUEUED';

CREATE INDEX jobs_expired_lease_idx
    ON jobs (queue_name, locked_until, priority DESC, available_at, id)
    WHERE status = 'PROCESSING';
