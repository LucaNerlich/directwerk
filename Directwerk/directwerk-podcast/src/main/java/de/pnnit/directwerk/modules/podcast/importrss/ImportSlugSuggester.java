package de.pnnit.directwerk.modules.podcast.importrss;

import de.pnnit.directwerk.modules.digital.importing.FeedImportSupport;

public final class ImportSlugSuggester {

    private static final String FALLBACK = "folge";

    private ImportSlugSuggester() {
    }

    /**
     * Creates a URL-friendly episode slug from a title.
     *
     * @param title the title from which to create the slug
     * @return the normalized slug, or {@code "folge"} when the title is blank or cannot produce a valid slug
     */
    public static String suggest(String title) {
        return FeedImportSupport.suggestSlug(title, FALLBACK);
    }

    /**
     * Appends an attempt suffix to a slug while keeping the combined value within 64 characters.
     *
     * @param base    the slug to suffix
     * @param attempt the attempt number used to form the suffix
     * @return the unchanged base when the attempt is 1 or lower; otherwise, the suffixed slug
     */
    public static String withSuffix(String base, int attempt) {
        return FeedImportSupport.withSuffix(base, attempt, FALLBACK);
    }
}
