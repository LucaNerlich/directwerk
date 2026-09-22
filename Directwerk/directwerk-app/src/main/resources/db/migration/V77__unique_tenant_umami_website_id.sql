-- The application pre-check gives tenants an immediate validation error, but only a database
-- uniqueness fence closes the race between concurrent claims from different tenants. PostgreSQL
-- unique indexes already permit multiple NULL values; the predicate keeps the index compact.
CREATE UNIQUE INDEX uq_tenant_branding_umami_website_id
    ON tenant_branding (umami_website_id)
    WHERE umami_website_id IS NOT NULL;
