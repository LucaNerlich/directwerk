CREATE TABLE platform_audit_events (
    id              BIGSERIAL PRIMARY KEY,
    action          VARCHAR(64)  NOT NULL,
    actor_user_id   BIGINT       REFERENCES users(id),
    tenant_id       BIGINT       REFERENCES tenants(id),
    details         JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_audit_events_tenant_id ON platform_audit_events(tenant_id);
CREATE INDEX idx_platform_audit_events_actor_user_id ON platform_audit_events(actor_user_id);
CREATE INDEX idx_platform_audit_events_created_at ON platform_audit_events(created_at);
CREATE INDEX idx_platform_audit_events_action ON platform_audit_events(action);
