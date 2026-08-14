-- PaymentIntent id for one-time Stripe checkouts so charge.refunded can revoke access.

ALTER TABLE subscriptions
    ADD COLUMN external_payment_id VARCHAR(64);

CREATE INDEX idx_subscriptions_external_payment
    ON subscriptions(tenant_id, external_payment_id);
