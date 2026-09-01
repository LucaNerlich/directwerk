-- Bonus content (entitlement-gated subscriber downloads, distributed via level/product gating)
-- was only ever guarded by the generic DIGITAL_CONTENT module, even though it is not
-- podcast/article specific and admins had no way to disable it independently. Introduce a
-- dedicated BONUS_CONTENT module, sibling to PODCAST/ARTICLES under DIGITAL_CONTENT.
INSERT INTO feature_modules (module_key, name, depends_on, is_core, platform_active) VALUES
    ('BONUS_CONTENT', 'Bonus Content', '["DIGITAL_CONTENT"]', FALSE, TRUE);

-- Preserve current behavior for every tenant that already has DIGITAL_CONTENT active (i.e. every
-- tenant currently able to reach entitlement-gated downloads under the old DIGITAL_CONTENT-gated
-- logic). Existing tenants keep exactly the access they have today; going forward, admins can
-- disable BONUS_CONTENT independently via the platform admin module panel.
INSERT INTO tenant_module_activations (tenant_id, module_key, active, activated_at, source)
SELECT tenant_id, 'BONUS_CONTENT', TRUE, NOW(), 'MIGRATION'
FROM tenant_module_activations
WHERE module_key = 'DIGITAL_CONTENT' AND active = TRUE
ON CONFLICT (tenant_id, module_key) DO NOTHING;
