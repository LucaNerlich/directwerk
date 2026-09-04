-- Per-editor permission overrides managed by tenant admins (issue #148).
-- Rows are deny-only: presence takes a right away from the role baseline and can
-- never escalate beyond it. Overrides never apply to tenant admins.
ALTER TABLE tenant_memberships
    ADD CONSTRAINT uq_tenant_memberships_tenant_id UNIQUE (tenant_id, id);

CREATE TABLE membership_permission_overrides (
    id BIGSERIAL PRIMARY KEY,
    membership_id BIGINT NOT NULL,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(32) NOT NULL,
    operation VARCHAR(32) NOT NULL,
    scope VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_membership_permission_override
        UNIQUE (membership_id, entity_type, operation),
    CONSTRAINT fk_membership_permission_override_tenant_membership
        FOREIGN KEY (tenant_id, membership_id)
        REFERENCES tenant_memberships (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT chk_membership_permission_override_scope
        CHECK (scope IN ('DENY', 'OTHERS_ONLY'))
);

CREATE INDEX idx_membership_permission_overrides_tenant_user
    ON membership_permission_overrides(tenant_id, membership_id);
