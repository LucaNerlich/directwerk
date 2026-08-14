CREATE TABLE invitation_tokens (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 BIGINT NOT NULL REFERENCES users(id),
    tenant_membership_id    BIGINT REFERENCES tenant_memberships(id),
    type                    VARCHAR(32) NOT NULL,
    token_hash              VARCHAR(64) NOT NULL,
    expires_at              TIMESTAMPTZ NOT NULL,
    used_at                 TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT invitation_tokens_type_check
        CHECK (type IN ('TENANT_MEMBER', 'PLATFORM_ADMIN')),
    CONSTRAINT invitation_tokens_target_check
        CHECK (
            (type = 'TENANT_MEMBER' AND tenant_membership_id IS NOT NULL)
            OR (type = 'PLATFORM_ADMIN' AND tenant_membership_id IS NULL)
        )
);

CREATE UNIQUE INDEX uq_invitation_tokens_token_hash ON invitation_tokens(token_hash);
CREATE INDEX idx_invitation_tokens_user_id ON invitation_tokens(user_id);
CREATE INDEX idx_invitation_tokens_membership_id ON invitation_tokens(tenant_membership_id);
CREATE INDEX idx_invitation_tokens_expires_at ON invitation_tokens(expires_at);
