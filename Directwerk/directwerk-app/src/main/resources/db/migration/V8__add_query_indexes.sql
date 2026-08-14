-- Case-insensitive email uniqueness for login/registration lookups
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_email_key;

DROP INDEX IF EXISTS idx_users_email_lower;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (LOWER(email));

-- Active modules per tenant (ModuleGateService.findByTenantIdAndActiveTrue)
CREATE INDEX IF NOT EXISTS idx_tenant_module_activations_tenant_active
    ON tenant_module_activations (tenant_id)
    WHERE active = TRUE;

-- Tenant user listing filtered by membership status
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_status
    ON tenant_memberships (tenant_id, status);

-- Password reset token validation
CREATE UNIQUE INDEX IF NOT EXISTS uq_password_reset_tokens_token_hash
    ON password_reset_tokens (token_hash);
