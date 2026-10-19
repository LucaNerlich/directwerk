-- Issue #539: the article newsletter fan-out re-runs when the CONTENT_NOTIFY job's lease expires
-- between commit and complete(), re-resolving recipients and enqueueing a second campaign.
-- Claim each (tenant, article, recipient email) once, like the episode fan-out does per user.
CREATE TABLE newsletter_notification_markers (
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content_id      BIGINT NOT NULL,
    recipient_email VARCHAR(320) NOT NULL,
    notified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, content_id, recipient_email)
);

CREATE INDEX idx_newsletter_notification_markers_content
    ON newsletter_notification_markers (tenant_id, content_id);
