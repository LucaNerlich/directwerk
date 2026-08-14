-- Bind tenant-scoped user references to tenant_memberships instead of global users.

ALTER TABLE tenant_memberships
    ADD CONSTRAINT uq_tenant_memberships_tenant_user UNIQUE (tenant_id, user_id);

ALTER TABLE subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

ALTER TABLE subscriptions
    ADD CONSTRAINT fk_subscriptions_tenant_membership
        FOREIGN KEY (tenant_id, user_id)
        REFERENCES tenant_memberships (tenant_id, user_id)
        ON DELETE CASCADE;

ALTER TABLE subscriber_feeds
    DROP CONSTRAINT IF EXISTS subscriber_feeds_user_id_fkey;

ALTER TABLE subscriber_feeds
    ADD CONSTRAINT fk_subscriber_feeds_tenant_membership
        FOREIGN KEY (tenant_id, user_id)
        REFERENCES tenant_memberships (tenant_id, user_id)
        ON DELETE CASCADE;
