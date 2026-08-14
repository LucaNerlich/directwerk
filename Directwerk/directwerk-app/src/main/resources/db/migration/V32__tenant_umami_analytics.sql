ALTER TABLE tenant_branding
    ADD COLUMN umami_website_id VARCHAR(64);

UPDATE feature_modules
SET platform_active = TRUE
WHERE module_key = 'ANALYTICS';
