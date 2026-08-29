package de.pnnit.directwerk.modules.podcast.importrss;

import java.util.Locale;
import java.util.regex.Pattern;

final class ImportSlugSuggester {

    private static final Pattern NON_SLUG = Pattern.compile("[^a-z0-9]+");

    private ImportSlugSuggester() {
    }

    static String suggest(String title) {
        if (title == null || title.isBlank()) {
            return "folge";
        }
        String folded = foldGerman(title.trim());
        String slug = NON_SLUG.matcher(folded.toLowerCase(Locale.ROOT)).replaceAll("-");
        slug = slug.replaceAll("^-+|-+$", "");
        if (slug.length() > 63) {
            slug = slug.substring(0, 63).replaceAll("-+$", "");
        }
        if (slug.isEmpty() || !Character.isLetterOrDigit(slug.charAt(0))) {
            slug = "folge";
        }
        if (slug.length() == 1) {
            return slug;
        }
        if (!Character.isLetterOrDigit(slug.charAt(slug.length() - 1))) {
            slug = slug.substring(0, slug.length() - 1);
        }
        return slug.isEmpty() ? "folge" : slug;
    }

    private static String foldGerman(String title) {
        return title
                .replace("ä", "ae")
                .replace("ö", "oe")
                .replace("ü", "ue")
                .replace("Ä", "Ae")
                .replace("Ö", "Oe")
                .replace("Ü", "Ue")
                .replace("ß", "ss");
    }

    static String withSuffix(String base, int attempt) {
        if (attempt <= 1) {
            return base;
        }
        String suffix = "-" + attempt;
        int maxBase = Math.max(1, 64 - suffix.length());
        String trimmed = base.length() > maxBase ? base.substring(0, maxBase).replaceAll("-+$", "") : base;
        if (trimmed.isEmpty()) {
            trimmed = "folge";
        }
        return trimmed + suffix;
    }
}
