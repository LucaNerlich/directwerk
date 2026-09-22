-- Per-recipient idempotency for content-notify fan-out. The content-notify queue job can be
-- retried after it already enqueued email jobs (coalescing only covers QUEUED jobs), so a
-- per-content/per-user marker claimed once makes the fan-out idempotent: a retry skips
-- subscribers who were already notified.
CREATE TABLE content_notification_markers (
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content_type    VARCHAR(32) NOT NULL,
    content_id      BIGINT NOT NULL,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, content_type, content_id, user_id)
);

CREATE INDEX idx_content_notification_markers_content
    ON content_notification_markers (tenant_id, content_type, content_id);
