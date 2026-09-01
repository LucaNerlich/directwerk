-- Repeatable local/docker seed for HTTP client tests.
-- Applied by LocalDevSeedRunner after Flyway, not as a Flyway migration.
-- User passwords are seeded by DevDataInitializer (BCrypt hashes cannot be stored in SQL).

INSERT INTO tenants (slug, name, status) VALUES
    ('alpha-show-a', 'Alpha Show A', 'ACTIVE'),
    ('alpha-show-b', 'Alpha Show B', 'ACTIVE')
ON CONFLICT (slug) DO NOTHING;

SELECT setval('tenants_id_seq', GREATEST((SELECT MAX(id) FROM tenants), 1));

INSERT INTO tenant_domains (tenant_id, host, verified, is_primary)
SELECT t.id, 'alpha-a.localhost', TRUE, TRUE
FROM tenants t
WHERE t.slug = 'alpha-show-a'
ON CONFLICT ((LOWER(host))) DO NOTHING;

INSERT INTO tenant_domains (tenant_id, host, verified, is_primary)
SELECT t.id, 'localhost', TRUE, FALSE
FROM tenants t
WHERE t.slug = 'alpha-show-a'
ON CONFLICT ((LOWER(host))) DO NOTHING;

INSERT INTO tenant_domains (tenant_id, host, verified, is_primary)
SELECT t.id, '127.0.0.1', TRUE, FALSE
FROM tenants t
WHERE t.slug = 'alpha-show-a'
ON CONFLICT ((LOWER(host))) DO NOTHING;

INSERT INTO tenant_domains (tenant_id, host, verified, is_primary)
SELECT t.id, 'alpha-b.localhost', TRUE, TRUE
FROM tenants t
WHERE t.slug = 'alpha-show-b'
ON CONFLICT ((LOWER(host))) DO NOTHING;

INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, site_title)
SELECT t.id, '#1a1a2e', '#e94560', 'Alpha Show A'
FROM tenants t
WHERE t.slug = 'alpha-show-a'
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, site_title)
SELECT t.id, '#16213e', '#0f3460', 'Alpha Show B'
FROM tenants t
WHERE t.slug = 'alpha-show-b'
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenant_module_activations (tenant_id, module_key, active, source)
SELECT t.id, seed.module_key, TRUE, 'SEED'
FROM tenants t
JOIN (VALUES
    ('alpha-show-a', 'DIGITAL_CONTENT'),
    ('alpha-show-a', 'PODCAST'),
    ('alpha-show-a', 'PODCAST_RSS'),
    ('alpha-show-a', 'WHITELABEL'),
    ('alpha-show-a', 'SUBSCRIPTION'),
    ('alpha-show-a', 'FEED_BUILDER'),
    ('alpha-show-a', 'EMAIL_NOTIFY'),
    ('alpha-show-b', 'DIGITAL_CONTENT'),
    ('alpha-show-b', 'ARTICLES')
) AS seed(tenant_slug, module_key) ON seed.tenant_slug = t.slug
ON CONFLICT (tenant_id, module_key) DO NOTHING;

INSERT INTO subscription_products (tenant_id, slug, title, offering_type, sort_order, active)
SELECT t.id, seed.slug, seed.title, 'LEVEL', seed.sort_order, TRUE
FROM tenants t
JOIN (VALUES
    ('alpha-show-a', 'supporter', 'Supporter', 1),
    ('alpha-show-a', 'producer', 'Producer', 2)
) AS seed(tenant_slug, slug, title, sort_order) ON seed.tenant_slug = t.slug
ON CONFLICT (tenant_id, slug) DO NOTHING;
