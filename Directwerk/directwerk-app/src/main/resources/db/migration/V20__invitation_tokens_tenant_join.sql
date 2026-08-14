-- Allow join-only invitations for already-active users (no password setup).
ALTER TABLE invitation_tokens
    DROP CONSTRAINT invitation_tokens_type_check;

ALTER TABLE invitation_tokens
    ADD CONSTRAINT invitation_tokens_type_check
        CHECK (type IN ('TENANT_MEMBER', 'TENANT_JOIN', 'PLATFORM_ADMIN')) NOT VALID;

ALTER TABLE invitation_tokens
    DROP CONSTRAINT invitation_tokens_target_check;

ALTER TABLE invitation_tokens
    ADD CONSTRAINT invitation_tokens_target_check
        CHECK (
            (type IN ('TENANT_MEMBER', 'TENANT_JOIN') AND tenant_membership_id IS NOT NULL)
            OR (type = 'PLATFORM_ADMIN' AND tenant_membership_id IS NULL)
        );
