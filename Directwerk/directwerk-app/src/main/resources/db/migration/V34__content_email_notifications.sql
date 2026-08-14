-- Subscriber opt-in for content notification emails (default off).
ALTER TABLE tenant_memberships
    ADD COLUMN email_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- First-publish tracking: survives unpublish/republish cycles.
ALTER TABLE episodes
    ADD COLUMN email_notified_at TIMESTAMPTZ,
    ADD COLUMN notify_subscribers_on_publish BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE articles
    ADD COLUMN email_notified_at TIMESTAMPTZ,
    ADD COLUMN notify_subscribers_on_publish BOOLEAN NOT NULL DEFAULT FALSE;

-- Per-tenant HTML overrides for content notification emails.
CREATE TABLE tenant_content_email_templates (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content_type    VARCHAR(32) NOT NULL,
    subject_template VARCHAR(512) NOT NULL,
    body_html       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenant_content_email_templates_content_type_check
        CHECK (content_type IN ('EPISODE', 'ARTICLE')),
    CONSTRAINT uq_tenant_content_email_templates_tenant_type UNIQUE (tenant_id, content_type)
);

-- Writer tenants need DIGITAL_CONTENT, not PODCAST_RSS, to use email notifications.
UPDATE feature_modules
SET depends_on = '["DIGITAL_CONTENT", "SUBSCRIPTION"]',
    platform_active = TRUE
WHERE module_key = 'EMAIL_NOTIFY';
