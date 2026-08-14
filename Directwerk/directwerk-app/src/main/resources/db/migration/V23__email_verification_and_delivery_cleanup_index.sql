ALTER TABLE invitation_tokens
    DROP CONSTRAINT invitation_tokens_type_check;

-- Add constraint with NOT VALID to avoid write-blocking validation lock
-- New writes are immediately enforced; explicit validation should happen in a later maintenance migration
ALTER TABLE invitation_tokens
    ADD CONSTRAINT invitation_tokens_type_check
        CHECK (type IN ('TENANT_MEMBER', 'TENANT_JOIN', 'PLATFORM_ADMIN', 'EMAIL_VERIFICATION')) NOT VALID;

ALTER TABLE invitation_tokens
    DROP CONSTRAINT invitation_tokens_target_check;

-- Add constraint with NOT VALID to avoid write-blocking validation lock
-- New writes are immediately enforced; explicit validation should happen in a later maintenance migration
ALTER TABLE invitation_tokens
    ADD CONSTRAINT invitation_tokens_target_check
        CHECK (
            (type IN ('TENANT_MEMBER', 'TENANT_JOIN', 'EMAIL_VERIFICATION') AND tenant_membership_id IS NOT NULL)
            OR (type = 'PLATFORM_ADMIN' AND tenant_membership_id IS NULL)
        ) NOT VALID;
