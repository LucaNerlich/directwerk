-- Tenant-scoped product reference and same-tenant scope validation for access rules.

ALTER TABLE product_access_rules
    DROP CONSTRAINT IF EXISTS product_access_rules_product_id_fkey;

ALTER TABLE product_access_rules
    ADD CONSTRAINT fk_product_access_rules_tenant_product
        FOREIGN KEY (tenant_id, product_id)
        REFERENCES subscription_products (tenant_id, id)
        ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION validate_product_access_rule_scope()
RETURNS TRIGGER AS $$
BEGIN
    CASE NEW.scope_type
        WHEN 'ALL_PODCASTS', 'FEED_BUILDER' THEN
            IF NEW.scope_id IS NOT NULL THEN
                RAISE EXCEPTION 'scope_id must be null for scope type %', NEW.scope_type;
            END IF;
        WHEN 'PODCAST_SERIES' THEN
            IF NEW.scope_id IS NULL OR NOT EXISTS (
                SELECT 1
                FROM podcast_series
                WHERE tenant_id = NEW.tenant_id
                  AND id = NEW.scope_id
            ) THEN
                RAISE EXCEPTION 'scope_id must reference a podcast series in the same tenant';
            END IF;
        WHEN 'FORMAT' THEN
            IF NEW.scope_id IS NULL OR NOT EXISTS (
                SELECT 1
                FROM formats
                WHERE tenant_id = NEW.tenant_id
                  AND id = NEW.scope_id
            ) THEN
                RAISE EXCEPTION 'scope_id must reference a format in the same tenant';
            END IF;
        WHEN 'CATEGORY' THEN
            IF NEW.scope_id IS NULL OR NOT EXISTS (
                SELECT 1
                FROM categories
                WHERE tenant_id = NEW.tenant_id
                  AND id = NEW.scope_id
            ) THEN
                RAISE EXCEPTION 'scope_id must reference a category in the same tenant';
            END IF;
        WHEN 'DIGITAL_ASSET' THEN
            IF NEW.scope_id IS NULL OR NOT EXISTS (
                SELECT 1
                FROM media_assets
                WHERE tenant_id = NEW.tenant_id
                  AND id = NEW.scope_id
            ) THEN
                RAISE EXCEPTION 'scope_id must reference a media asset in the same tenant';
            END IF;
        ELSE
            RAISE EXCEPTION 'unsupported scope type: %', NEW.scope_type;
    END CASE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_access_rule_scope
    BEFORE INSERT OR UPDATE ON product_access_rules
    FOR EACH ROW
    EXECUTE FUNCTION validate_product_access_rule_scope();
