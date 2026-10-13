-- Issue #369: EXPIRED is never produced by the application (no code path sets it), so drop it
-- from the status check so the schema matches SubscriptionStatus.
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('ACTIVE', 'CANCELED', 'PAST_DUE', 'INCOMPLETE'));
