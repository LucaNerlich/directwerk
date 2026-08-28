package de.pnnit.directwerk.modules.content;

/**
 * Shared rules for what paid vs free content may expose on public HTTP and RSS surfaces.
 */
public final class PublicContentProjection {

    private PublicContentProjection() {
    }

    public static boolean exposesFullContent(String accessPolicy) {
        return "FREE".equals(accessPolicy);
    }

    public static String articleBody(String body, String accessPolicy) {
        return exposesFullContent(accessPolicy) ? body : null;
    }

    public static boolean includesInPublicRss(String accessPolicy) {
        return "FREE".equals(accessPolicy);
    }
}
