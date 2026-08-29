package de.pnnit.directwerk.modules.content;

/**
 * Canonical public-site path grammar for episodes and articles.
 */
public final class PublicContentPaths {

    private PublicContentPaths() {
    }

    public static String episodePage(String slug) {
        return "/episodes/" + slug;
    }

    public static String articlePage(String slug) {
        return "/articles/" + slug;
    }

    public static String notificationPreferences() {
        return "/account/notifications";
    }
}
