-- Double opt-in confirm tokens now expire; the TTL was mailed to recipients but
-- never enforced at confirm time.
ALTER TABLE newsletter_subscriptions
    ADD COLUMN confirm_token_expires_at TIMESTAMPTZ;
