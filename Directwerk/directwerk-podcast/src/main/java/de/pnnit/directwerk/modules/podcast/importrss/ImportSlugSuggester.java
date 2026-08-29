package de.pnnit.directwerk.modules.podcast.importrss;

import java.util.Locale;
import java.util.regex.Pattern;

public final class ImportSlugSuggester {

    private static final Pattern NON_SLUG = Pattern.compile("[^a-z0-9]+");

    private ImportSlugSuggester() {
    }

    /**
     * Creates a URL-friendly slug from a title.
     *
     * @param title the title from which to create the slug
     * @return the normalized slug, or {@code "folge"} when the title is blank or cannot produce a valid slug
     */
    public static String suggest(String title) {
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

    /**
     * Replaces German umlauts and sharp s with their ASCII equivalents.
     *
     * @param title the text to convert
     * @return the text with German characters converted to ASCII
     */
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

    /**
     * Appends an attempt suffix to a slug while keeping the combined value within 64 characters.
     *
     * @param base    the slug to suffix
     * @param attempt the attempt number used to form the suffix
     * @return the unchanged base when the attempt is 1 or lower; otherwise, the suffixed slug
     */
    public static String withSuffix(String base, int attempt) {
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
