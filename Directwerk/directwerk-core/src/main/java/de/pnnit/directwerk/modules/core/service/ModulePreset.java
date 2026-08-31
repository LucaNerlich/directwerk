package de.pnnit.directwerk.modules.core.service;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

public enum ModulePreset {
    FREE_PODCAST("DIGITAL_CONTENT", "PODCAST", "PODCAST_RSS", "WHITELABEL"),
    WRITER("DIGITAL_CONTENT", "SUBSCRIPTION", "ARTICLE_RSS", "EMAIL_NOTIFY", "WHITELABEL"),
    PODCAST(
            "DIGITAL_CONTENT",
            "PODCAST",
            "PODCAST_RSS",
            "SUBSCRIPTION",
            "EMAIL_NOTIFY"
    ),
    FULL(
            "DIGITAL_CONTENT",
            "SUBSCRIPTION",
            "EMAIL_NOTIFY",
            "WHITELABEL",
            "PODCAST",
            "PODCAST_RSS"
    ),
    PATREON_MIGRATOR(
            "DIGITAL_CONTENT",
            "PODCAST",
            "PODCAST_RSS",
            "SUBSCRIPTION",
            "PATREON_SYNC",
            "WHITELABEL"
    ),
    PRO(
            "DIGITAL_CONTENT",
            "PODCAST",
            "PODCAST_RSS",
            "WHITELABEL",
            "SUBSCRIPTION",
            "FEED_BUILDER",
            "ARTICLE_RSS",
            "ARTICLE_FEED_BUILDER",
            "STRIPE_BILLING"
    ),
    ENTERPRISE(
            "DIGITAL_CONTENT",
            "PODCAST",
            "PODCAST_RSS",
            "WHITELABEL",
            "SUBSCRIPTION",
            "FEED_BUILDER",
            "ARTICLE_RSS",
            "ARTICLE_FEED_BUILDER",
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
