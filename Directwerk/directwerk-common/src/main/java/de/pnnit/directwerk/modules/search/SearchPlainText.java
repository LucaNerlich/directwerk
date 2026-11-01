package de.pnnit.directwerk.modules.search;

import java.util.regex.Pattern;
import org.springframework.web.util.HtmlUtils;

/**
 * Strips tags and collapses whitespace for the search index. Ranking stays on the client.
 */
public final class SearchPlainText {

    public static final int MAX_CHARS = 12_000;
    public static final int EXCERPT_CHARS = 180;

    private static final Pattern TAGS = Pattern.compile("<[^>]+>");

    private SearchPlainText() {
    }

    public static String fromHtml(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        String withoutTags = TAGS.matcher(html).replaceAll(" ");
        String decoded = HtmlUtils.htmlUnescape(withoutTags).replace('\u00A0', ' ');
        String collapsed = decoded.replaceAll("\\s+", " ").trim();
        if (collapsed.length() <= MAX_CHARS) {
            return collapsed;
        }
        return collapsed.substring(0, MAX_CHARS).trim();
    }

    /**
     * Short public snippet. Prefers an author excerpt, otherwise the start of the stripped body.
     * Paid articles must use {@link #authorExcerpt(String)} so a blank teaser never leaks the body.
     */
    public static String excerpt(String explicit, String plain) {
        String source = explicit == null || explicit.isBlank() ? nullToEmpty(plain) : fromHtml(explicit);
        return clipExcerpt(source);
    }

    /**
     * Author-written teaser only. Empty when the author left no excerpt — never the body prefix.
     */
    public static String authorExcerpt(String explicit) {
        if (explicit == null || explicit.isBlank()) {
            return "";
        }
        return clipExcerpt(fromHtml(explicit));
    }

    private static String clipExcerpt(String source) {
        if (source.length() <= EXCERPT_CHARS) {
            return source;
        }
        return source.substring(0, EXCERPT_CHARS).trim();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
