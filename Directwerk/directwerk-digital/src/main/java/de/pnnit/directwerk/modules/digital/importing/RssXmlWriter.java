package de.pnnit.directwerk.modules.digital.importing;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.function.Function;
import java.util.function.UnaryOperator;

/**
 * Writes RSS 2.0 documents from a neutral channel plus a per-entry projection.
 *
 * <p>The podcast and newsletter feed builders differ only in channel metadata and
 * in which item fields they publish; the XML shape, XML-1.0 character sanitising,
 * CDATA handling and date formatting are shared here so a well-formedness fix lands
 * in both feeds at once.</p>
 */
public final class RssXmlWriter {

    private static final DateTimeFormatter RSS_DATE_FORMATTER = DateTimeFormatter.RFC_1123_DATE_TIME;
    private static final String ITUNES_NS = " xmlns:itunes=\"http://www.itunes.com/dtds/podcast-1.0.dtd\"";

    /**
     * Issue #320: characters outside the XML 1.0 {@code Char} production (U+0000-U+0008,
     * U+000B, U+000C, U+000E-U+001F) are not legal in XML text; a single one makes the whole
     * document non-well-formed, so every subscriber's reader fails on the feed.
     */
    private static final java.util.regex.Pattern INVALID_XML_CHARS =
            java.util.regex.Pattern.compile("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]");

    private RssXmlWriter() {
    }

    /**
     * Builds a complete RSS 2.0 document.
     *
     * @param channel    the channel metadata; {@code itunes} adds the podcast namespace and
     *                   the category/explicit/image elements, {@code maxDescriptionChars}
     *                   bounds each sanitized description when non-null
     * @param entries    the source entries
     * @param projection maps one source entry to the item fields to publish
     * @param sanitizer  sanitizes description HTML before it is CDATA-wrapped
     * @param <T>        the source entry type
     * @return the RSS XML document
     */
    public static <T> String build(
            Channel channel,
            List<T> entries,
            Function<T, Item> projection,
            UnaryOperator<String> sanitizer
    ) {
        StringBuilder xml = new StringBuilder(4096);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<rss version=\"2.0\"").append(channel.itunes() ? ITUNES_NS : "").append(">\n");
        xml.append("  <channel>\n");
        appendElement(xml, "title", channel.title(), 4);
        appendElement(xml, "link", channel.link(), 4);
        appendDescriptionElement(xml, channel.descriptionHtml(), 4, sanitizer, channel.maxDescriptionChars());
        appendElement(xml, "language", channel.language(), 4);
        appendOwnerContact(xml, channel, 4);
        if (channel.itunes()) {
            appendItunesCategory(xml, channel.itunesCategory(), 4);
            xml.append("    <itunes:explicit>")
                    .append(channel.itunesExplicit() ? "true" : "false")
                    .append("</itunes:explicit>\n");
            if (channel.imageUrl() != null && !channel.imageUrl().isBlank()) {
                appendItunesImage(xml, channel.imageUrl(), 4);
            }
            appendItunesOwner(xml, channel, 4);
        }
        for (T entry : entries) {
            appendItem(xml, projection.apply(entry), channel.itunes(), sanitizer, channel.maxDescriptionChars());
        }
        xml.append("  </channel>\n");
        xml.append("</rss>\n");
        return xml.toString();
    }

    private static void appendItem(
            StringBuilder xml,
            Item item,
            boolean itunes,
            UnaryOperator<String> sanitizer,
            Integer maxDescriptionChars
    ) {
        xml.append("    <item>\n");
        appendElement(xml, "title", item.title(), 6);
        appendElement(xml, "link", item.link(), 6);
        appendDescriptionElement(xml, item.descriptionHtml(), 6, sanitizer, maxDescriptionChars);
        appendElement(xml, "guid", item.guid(), 6, " isPermaLink=\"false\"");
        if (item.publishedAt() != null) {
            appendElement(xml, "pubDate", RSS_DATE_FORMATTER.format(item.publishedAt().atZone(ZoneOffset.UTC)), 6);
        }
        if (itunes && item.imageUrl() != null && !item.imageUrl().isBlank()) {
            appendItunesImage(xml, item.imageUrl(), 6);
        }
        if (item.enclosureUrl() != null && !item.enclosureUrl().isBlank()) {
            xml.append("      <enclosure url=\"")
                    .append(escapeText(item.enclosureUrl()))
                    .append("\" length=\"")
                    .append(item.enclosureLength() != null ? item.enclosureLength() : 0)
                    .append("\" type=\"")
                    .append(escapeText(item.enclosureMimeType() != null
                            ? item.enclosureMimeType()
                            : "application/octet-stream"))
                    .append("\"/>\n");
        }
        xml.append("    </item>\n");
    }

    private static void appendItunesImage(StringBuilder xml, String href, int spaces) {
        xml.append(" ".repeat(spaces))
                .append("<itunes:image href=\"")
                .append(escapeText(href))
                .append("\"/>\n");
    }

    private static void appendItunesCategory(StringBuilder xml, String category, int spaces) {
        if (category == null || category.isBlank()) {
            return;
        }
        xml.append(" ".repeat(spaces))
                .append("<itunes:category text=\"")
                .append(escapeText(category))
                .append("\"/>\n");
    }

    /**
     * RSS 2.0 {@code managingEditor} / {@code webMaster} when a tenant contact email is set.
     * Format matches common podcast feeds: {@code email (Name)}.
     */
    private static void appendOwnerContact(StringBuilder xml, Channel channel, int spaces) {
        String email = channel.ownerEmail();
        if (email == null || email.isBlank()) {
            return;
        }
        String name = channel.ownerName() == null || channel.ownerName().isBlank()
                ? email
                : channel.ownerName();
        String withName = email + " (" + name + ")";
        appendElement(xml, "managingEditor", withName, spaces);
        appendElement(xml, "webMaster", withName, spaces);
    }

    private static void appendItunesOwner(StringBuilder xml, Channel channel, int spaces) {
        String email = channel.ownerEmail();
        if (email == null || email.isBlank()) {
            return;
        }
        String name = channel.ownerName() == null || channel.ownerName().isBlank()
                ? email
                : channel.ownerName();
        String indent = " ".repeat(spaces);
        xml.append(indent).append("<itunes:owner>\n");
        appendElement(xml, "itunes:name", name, spaces + 2);
        appendElement(xml, "itunes:email", email, spaces + 2);
        xml.append(indent).append("</itunes:owner>\n");
    }

    /**
     * Sanitizes a description and wraps it in CDATA so readers render rich text as HTML.
     * A per-feed character bound keeps one oversized item from dominating the document.
     */
    private static void appendDescriptionElement(
            StringBuilder xml,
            String value,
            int spaces,
            UnaryOperator<String> sanitizer,
            Integer maxDescriptionChars
    ) {
        String description = sanitizer.apply(value);
        if (maxDescriptionChars != null) {
            description = truncateHtml(description, maxDescriptionChars);
        }
        xml.append(" ".repeat(spaces))
                .append("<description>")
                .append(cdata(description))
                .append("</description>\n");
    }

    /**
     * Bounds sanitized description HTML without splitting a tag, an entity or a surrogate pair
     * (issue #589): a blind substring can end mid-tag, and parsers then discard the tail of the
     * show notes as attribute gibberish.
     */
    static String truncateHtml(String html, int maxChars) {
        if (html == null || html.length() <= maxChars) {
            return html;
        }
        int cut = maxChars;
        if (cut > 0 && Character.isHighSurrogate(html.charAt(cut - 1))) {
            cut--;
        }
        int lastTagOpen = html.lastIndexOf('<', cut - 1);
        int lastTagClose = html.lastIndexOf('>', cut - 1);
        if (lastTagOpen > lastTagClose) {
            // The cut lands inside a tag: stop before it opens (issue #685 review). Do not back
            // up to the previous '>' unconditionally — that would collapse a description that is
            // one long element to its opening tag.
            cut = lastTagOpen;
        } else {
            // Plain text at the cut: do not leave an unterminated entity (&amp / &#1234).
            int lastSemicolon = html.lastIndexOf(';', cut - 1);
            int lastAmpersand = html.lastIndexOf('&', cut - 1);
            if (lastAmpersand > lastSemicolon) {
                cut = lastAmpersand;
            }
        }
        return html.substring(0, Math.max(cut, 0)).trim();
    }

    private static void appendElement(StringBuilder xml, String name, String value, int spaces) {
        appendElement(xml, name, value, spaces, "");
    }

    private static void appendElement(StringBuilder xml, String name, String value, int spaces, String attributes) {
        xml.append(" ".repeat(spaces))
                .append("<")
                .append(name)
                .append(attributes)
                .append(">")
                .append(escapeText(value != null ? value : ""))
                .append("</")
                .append(name)
                .append(">\n");
    }

    /**
     * Escapes XML metacharacters after dropping characters XML 1.0 cannot represent.
     *
     * @param value the raw text
     * @return the escaped, well-formed text
     */
    public static String escapeText(String value) {
        return INVALID_XML_CHARS.matcher(value).replaceAll("")
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    /**
     * Wraps pre-sanitized content in a CDATA section so readers render rich text as HTML.
     * A literal {@code ]]>} inside the content is split across CDATA boundaries to keep
     * the document well-formed.
     *
     * @param value the pre-sanitized content
     * @return the CDATA-wrapped content
     */
    public static String cdata(String value) {
        return "<![CDATA[" + value.replace("]]>", "]]]]><![CDATA[>") + "]]>";
    }

    public record Channel(
            String title,
            String link,
            String descriptionHtml,
            String language,
            boolean itunes,
            String itunesCategory,
            boolean itunesExplicit,
            String imageUrl,
            Integer maxDescriptionChars,
            String ownerEmail,
            String ownerName
    ) {
        /** Convenience for feeds with no podcast owner contact. */
        public Channel(
                String title,
                String link,
                String descriptionHtml,
                String language,
                boolean itunes,
                String itunesCategory,
                boolean itunesExplicit,
                String imageUrl,
                Integer maxDescriptionChars
        ) {
            this(
                    title,
                    link,
                    descriptionHtml,
                    language,
                    itunes,
                    itunesCategory,
                    itunesExplicit,
                    imageUrl,
                    maxDescriptionChars,
                    null,
                    null
            );
        }
    }

    public record Item(
            String title,
            String link,
            String descriptionHtml,
            String guid,
            Instant publishedAt,
            String imageUrl,
            String enclosureUrl,
            Long enclosureLength,
            String enclosureMimeType
    ) {
    }
}
