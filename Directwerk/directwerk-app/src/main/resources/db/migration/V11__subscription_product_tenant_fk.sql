ALTER TABLE subscription_products
    ADD CONSTRAINT uq_subscription_products_tenant_id UNIQUE (tenant_id, id);

ALTER TABLE subscriptions
    DROP CONSTRAINT subscriptions_product_id_fkey;

ALTER TABLE subscriptions
    ADD CONSTRAINT fk_subscriptions_tenant_product
        FOREIGN KEY (tenant_id, product_id)
        REFERENCES subscription_products (tenant_id, id)
        ON DELETE RESTRICT;
