-- Stripe Connect accounts, catalog money fields, subscription external ids,
-- and webhook idempotency. Complements V10 subscription tables.

CREATE TABLE tenant_stripe_accounts (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    stripe_account_id   VARCHAR(64) NOT NULL UNIQUE,
    charges_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    payouts_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    details_submitted   BOOLEAN NOT NULL DEFAULT FALSE,
    status              VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenant_stripe_accounts_status_check
        CHECK (status IN ('PENDING', 'RESTRICTED', 'CONNECTED'))
);

CREATE INDEX idx_tenant_stripe_accounts_account
    ON tenant_stripe_accounts(stripe_account_id);

CREATE TABLE stripe_customers (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id  VARCHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id),
    UNIQUE (tenant_id, stripe_customer_id)
);

CREATE INDEX idx_stripe_customers_tenant_user
    ON stripe_customers(tenant_id, user_id);

ALTER TABLE subscription_products
    ADD COLUMN description VARCHAR(2000),
    ADD COLUMN price_cents INT,
    ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    ADD COLUMN billing_interval VARCHAR(16) NOT NULL DEFAULT 'MONTH',
    ADD COLUMN stripe_product_id VARCHAR(64),
    ADD COLUMN stripe_price_id VARCHAR(64);

ALTER TABLE subscription_products
    ADD CONSTRAINT subscription_products_billing_interval_check
        CHECK (billing_interval IN ('MONTH', 'YEAR', 'ONE_TIME'));

ALTER TABLE subscription_products
    ADD CONSTRAINT subscription_products_currency_check
        CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE subscription_products
    ADD CONSTRAINT subscription_products_price_cents_check
        CHECK (price_cents IS NULL OR price_cents >= 0);

ALTER TABLE subscriptions
    ADD COLUMN external_subscription_id VARCHAR(64),
    ADD COLUMN stripe_customer_id VARCHAR(64);

ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('ACTIVE', 'CANCELED', 'EXPIRED', 'PAST_DUE', 'INCOMPLETE'));

CREATE UNIQUE INDEX uq_subscriptions_tenant_external
    ON subscriptions(tenant_id, external_subscription_id)
    WHERE external_subscription_id IS NOT NULL;

CREATE TABLE processed_webhook_events (
    id                  BIGSERIAL PRIMARY KEY,
    event_id            VARCHAR(128) NOT NULL UNIQUE,
    event_type          VARCHAR(128) NOT NULL,
    stripe_account_id   VARCHAR(64),
    processed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
