package de.pnnit.directwerk.modules.content;

/**
 * Shared HTML text handling for publication workflows (podcast episodes and newsletter
 * articles). One implementation so excerpt length, blank-detection and entity handling
 * behave identically across content types.
 */
public final class PublicationTexts {

    private static final int EXCERPT_MAX_LENGTH = 280;
    private static final String ELLIPSIS = "...";

    private PublicationTexts() {
    }

    /** Strips tags to plain text, collapses whitespace, truncates to 280 chars with ellipsis. */
    public static String htmlExcerpt(String html) {
        if (html == null) {
            return "";
        }
        String textOnly = html
                .replaceAll("<[^>]*>", " ")
                .replace("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (textOnly.length() <= EXCERPT_MAX_LENGTH) {
            return textOnly;
        }
        return textOnly.substring(0, EXCERPT_MAX_LENGTH - ELLIPSIS.length()) + ELLIPSIS;
    }

    /** Author-provided excerpt if present; otherwise derived from the body HTML. */
    public static String excerptOr(String providedExcerpt, String bodyHtml) {
        if (providedExcerpt != null && !providedExcerpt.isBlank()) {
            return providedExcerpt.trim();
        }
        return htmlExcerpt(bodyHtml);
    }

    /** Whether sanitized HTML carries no visible text (blank body/description guard). */
    public static boolean isBlankHtml(String sanitized) {
        if (sanitized == null) {
            return true;
        }
        String textOnly = sanitized
                .replaceAll("<[^>]*>", "")
                .replace("&nbsp;", " ")
                .trim();
        return textOnly.isBlank();
    }
}
