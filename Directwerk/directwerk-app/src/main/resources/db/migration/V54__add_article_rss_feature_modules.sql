-- ARTICLE_RSS and ARTICLE_FEED_BUILDER were referenced throughout the newsletter module
-- (FeatureModuleKeys, ArticleRssModule, ArticleFeedBuilderModule, ModulePreset.WRITER/PRO/ENTERPRISE,
-- @RequiresModule gates) but were never inserted into feature_modules by V3, so the module could
-- never be activated for any tenant: it was absent from the admin module catalog and silently
-- skipped by applyPreset (which only iterates modules already present in this table).
INSERT INTO feature_modules (module_key, name, depends_on, is_core, platform_active) VALUES
    ('ARTICLE_RSS', 'Article RSS', '["DIGITAL_CONTENT"]', FALSE, TRUE),
    ('ARTICLE_FEED_BUILDER', 'Article Feed Builder', '["ARTICLE_RSS", "SUBSCRIPTION"]', FALSE, TRUE);
