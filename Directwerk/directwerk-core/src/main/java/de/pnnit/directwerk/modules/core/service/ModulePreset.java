package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.FeatureModuleKeys;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

public enum ModulePreset {
    FREE_PODCAST(FeatureModuleKeys.DIGITAL_CONTENT, FeatureModuleKeys.PODCAST, FeatureModuleKeys.PODCAST_RSS, FeatureModuleKeys.WHITELABEL),
    WRITER(FeatureModuleKeys.DIGITAL_CONTENT, FeatureModuleKeys.ARTICLES, FeatureModuleKeys.SUBSCRIPTION, FeatureModuleKeys.ARTICLE_RSS, FeatureModuleKeys.BONUS_CONTENT, FeatureModuleKeys.EMAIL_NOTIFY, FeatureModuleKeys.WHITELABEL),
    PODCAST(
            FeatureModuleKeys.DIGITAL_CONTENT,
            FeatureModuleKeys.PODCAST,
            FeatureModuleKeys.PODCAST_RSS,
            FeatureModuleKeys.SUBSCRIPTION,
            FeatureModuleKeys.BONUS_CONTENT,
            FeatureModuleKeys.EMAIL_NOTIFY
    ),
    FULL(
            FeatureModuleKeys.DIGITAL_CONTENT,
            FeatureModuleKeys.SUBSCRIPTION,
            FeatureModuleKeys.BONUS_CONTENT,
            FeatureModuleKeys.EMAIL_NOTIFY,
            FeatureModuleKeys.WHITELABEL,
            FeatureModuleKeys.PODCAST,
            FeatureModuleKeys.PODCAST_RSS
    ),
    PATREON_MIGRATOR(
            FeatureModuleKeys.DIGITAL_CONTENT,
            FeatureModuleKeys.PODCAST,
            FeatureModuleKeys.PODCAST_RSS,
            FeatureModuleKeys.SUBSCRIPTION,
            FeatureModuleKeys.BONUS_CONTENT,
            "PATREON_SYNC",
            FeatureModuleKeys.WHITELABEL
    ),
    PRO(
            FeatureModuleKeys.DIGITAL_CONTENT,
            FeatureModuleKeys.PODCAST,
            FeatureModuleKeys.PODCAST_RSS,
            FeatureModuleKeys.WHITELABEL,
            FeatureModuleKeys.SUBSCRIPTION,
            FeatureModuleKeys.BONUS_CONTENT,
            FeatureModuleKeys.FEED_BUILDER,
            FeatureModuleKeys.ARTICLES,
            FeatureModuleKeys.ARTICLE_RSS,
            FeatureModuleKeys.ARTICLE_FEED_BUILDER,
            "STRIPE_BILLING"
    ),
    ENTERPRISE(
            FeatureModuleKeys.DIGITAL_CONTENT,
            FeatureModuleKeys.PODCAST,
            FeatureModuleKeys.PODCAST_RSS,
            FeatureModuleKeys.WHITELABEL,
            FeatureModuleKeys.SUBSCRIPTION,
            FeatureModuleKeys.BONUS_CONTENT,
            FeatureModuleKeys.FEED_BUILDER,
            FeatureModuleKeys.ARTICLES,
            FeatureModuleKeys.ARTICLE_RSS,
            FeatureModuleKeys.ARTICLE_FEED_BUILDER,
            "STRIPE_BILLING",
            "PATREON_SYNC",
            "STEADY_SYNC",
            "ANALYTICS"
    );

    private final List<String> moduleKeys;

    ModulePreset(String... moduleKeys) {
        this.moduleKeys = List.of(moduleKeys);
    }

    public List<String> moduleKeys() {
        return moduleKeys;
    }

    public static Optional<ModulePreset> fromKey(String presetKey) {
        if (presetKey == null || presetKey.isBlank()) {
            return Optional.empty();
        }
        return Arrays.stream(values())
                .filter(preset -> preset.name().equalsIgnoreCase(presetKey.trim()))
                .findFirst();
    }
}
