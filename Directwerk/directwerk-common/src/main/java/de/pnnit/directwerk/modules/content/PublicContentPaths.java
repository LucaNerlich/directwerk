package de.pnnit.directwerk.modules.content;

import java.util.Locale;

/**
 * Canonical public-site path grammar for episodes and articles.
 *
 * <p>UI deep links (email, studio “open site”) are locale-prefixed ({@code /de/...},
 * {@code /en/...}) to match {@code directwerk-web}'s {@code app/[lang]} routes. Protocol
 * surfaces (RSS item links) use the unprefixed {@code *Path} helpers so podcatchers keep
 * stable URLs; the web proxy still redirects unprefixed hits to the default locale.
 */
public final class PublicContentPaths {

    /** Product default locale — keep in sync with {@code packages/ui} {@code defaultLocale}. */
    public static final String DEFAULT_LOCALE = "de";

    private PublicContentPaths() {
    }

    /** Unprefixed episode path for RSS / protocol surfaces. */
    public static String episodePath(String slug) {
        return "/episodes/" + slug;
    }

    /** Unprefixed article path for RSS / protocol surfaces. */
    public static String articlePath(String slug) {
        return "/articles/" + slug;
    }

    /** Locale-prefixed episode page for email deep links and studio previews. */
    public static String episodePage(String slug) {
        return localized(DEFAULT_LOCALE, episodePath(slug));
    }

    /** Locale-prefixed article page for email deep links and studio previews. */
    public static String articlePage(String slug) {
        return localized(DEFAULT_LOCALE, articlePath(slug));
    }

    public static String notificationPreferences() {
        return localized(DEFAULT_LOCALE, "/account/notifications");
    }

    public static String newsletterConfirm() {
        return localized(DEFAULT_LOCALE, "/newsletter/confirm");
    }

    public static String newsletterUnsubscribe() {
        return localized(DEFAULT_LOCALE, "/newsletter/unsubscribe");
    }

    public static String newsletterSubscribe(String listSlug) {
        return localized(DEFAULT_LOCALE, "/newsletter/" + listSlug);
    }

    /**
     * Prefixes an absolute path with a locale segment. Blank/null locale falls back to
     * {@link #DEFAULT_LOCALE}.
     */
    public static String localized(String locale, String absolutePath) {
        String lang = (locale == null || locale.isBlank())
                ? DEFAULT_LOCALE
                : locale.trim().toLowerCase(Locale.ROOT);
        String path = absolutePath.startsWith("/") ? absolutePath : "/" + absolutePath;
        return "/" + lang + path;
    }
}
