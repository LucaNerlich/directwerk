package de.pnnit.directwerk.modules.core.util;

public final class TitleNormalizer {

    public static final int MAX_TITLE_LENGTH = 255;

    private TitleNormalizer() {
    }

    public static String normalize(String rawTitle, String label) {
        if (rawTitle == null || rawTitle.isBlank()) {
            throw new IllegalArgumentException(label + " title is required");
        }
        String normalized = rawTitle.trim();
        if (normalized.length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException(
                    label + " title must be at most " + MAX_TITLE_LENGTH + " characters"
            );
        }
        return normalized;
    }
}
