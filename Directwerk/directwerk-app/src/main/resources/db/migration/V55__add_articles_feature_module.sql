-- ARTICLE_RSS/ARTICLE_FEED_BUILDER previously depended directly on DIGITAL_CONTENT, so there was no
-- way to disable the Write desk for a tenant without disabling DIGITAL_CONTENT itself (which also
-- backs podcast bonus-content storage). Introduce a dedicated ARTICLES module, mirroring how PODCAST
-- sits between DIGITAL_CONTENT and PODCAST_RSS/FEED_BUILDER.
INSERT INTO feature_modules (module_key, name, depends_on, is_core, platform_active) VALUES
    ('ARTICLES', 'Articles', '["DIGITAL_CONTENT"]', FALSE, TRUE);

UPDATE feature_modules SET depends_on = '["ARTICLES"]' WHERE module_key = 'ARTICLE_RSS';

-- Preserve current behavior for every tenant that already has DIGITAL_CONTENT active (i.e. every
-- tenant currently seeing the Write desk under the old DIGITAL_CONTENT-gated logic), and for any
-- tenant with ARTICLE_RSS/ARTICLE_FEED_BUILDER already active (which would otherwise now violate
-- the new ARTICLES dependency). Existing tenants keep exactly the access they have today; going
-- forward, admins can disable ARTICLES independently via the platform admin module panel.
INSERT INTO tenant_module_activations (tenant_id, module_key, active, activated_at, source)
SELECT tenant_id, 'ARTICLES', TRUE, NOW(), 'MIGRATION'
FROM tenant_module_activations
WHERE module_key = 'DIGITAL_CONTENT' AND active = TRUE
ON CONFLICT (tenant_id, module_key) DO NOTHING;
