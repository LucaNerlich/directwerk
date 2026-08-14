package de.pnnit.directwerk.modules.core.util;

import java.util.Locale;
import java.util.regex.Pattern;

public final class SlugNormalizer {

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$");

    private SlugNormalizer() {
    }

    public static String normalize(String rawSlug) {
        if (rawSlug == null) {
            throw new IllegalArgumentException("Slug is required");
        }
        String normalized = rawSlug.trim().toLowerCase(Locale.ROOT);
        if (!SLUG_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException(
                    "Slug must be 1-64 lowercase letters, digits, or hyphens"
            );
        }
        return normalized;
    }
}
