package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.content.PublicContentPaths;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RssXmlBuilder {

    private final HtmlSanitizer htmlSanitizer;

    private static final DateTimeFormatter RSS_DATE_FORMATTER = DateTimeFormatter.RFC_1123_DATE_TIME;
    private static final String ITUNES_NS = " xmlns:itunes=\"http://www.itunes.com/dtds/podcast-1.0.dtd\"";

    /**
     * Builds an RSS 2.0 podcast feed containing channel metadata and episode entries.
     *
     * @param tenant        the tenant associated with the feed
     * @param seriesOrNull  the podcast series, or {@code null} to derive metadata from the episodes or tenant
     * @param episodes      the episodes to include in the feed
     * @param originBaseUrl the URL used for the channel link
     * @return              the complete RSS XML document
     */
    public String buildPublicFeed(
            Tenant tenant,
            PodcastSeries seriesOrNull,
            List<RssEpisode> episodes,
            String originBaseUrl
    ) {
        return buildPublicFeed(tenant, seriesOrNull, episodes, originBaseUrl, null, null);
    }

    public String buildPublicFeed(
            Tenant tenant,
            PodcastSeries seriesOrNull,
            List<RssEpisode> episodes,
            String originBaseUrl,
            String channelTitleOverride
    ) {
        return buildPublicFeed(tenant, seriesOrNull, episodes, originBaseUrl, channelTitleOverride, null);
    }

    public String buildPublicFeed(
            Tenant tenant,
            PodcastSeries seriesOrNull,
            List<RssEpisode> episodes,
            String originBaseUrl,
            String channelTitleOverride,
            String channelCoverImageUrl
    ) {
        StringBuilder xml = new StringBuilder(4096);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<rss version=\"2.0\"").append(ITUNES_NS).append(">\n");
        xml.append("  <channel>\n");
        appendElement(xml, "title", channelTitle(tenant, seriesOrNull, episodes, channelTitleOverride), 4);
        appendElement(xml, "link", originBaseUrl, 4);
        appendDescriptionElement(xml, channelDescription(tenant, seriesOrNull), 4);
        appendElement(xml, "language", channelLanguage(seriesOrNull, episodes), 4);
        appendItunesCategory(xml, channelItunesCategory(seriesOrNull, episodes), 4);
        appendElement(xml, "itunes:explicit", channelExplicit(seriesOrNull, episodes), 4);
        if (channelCoverImageUrl != null && !channelCoverImageUrl.isBlank()) {
            appendItunesImage(xml, channelCoverImageUrl, 4);
        }
        for (RssEpisode rssEpisode : episodes) {
            appendEpisode(xml, tenant, originBaseUrl, rssEpisode);
        }
        xml.append("  </channel>\n");
        xml.append("</rss>\n");
        return xml.toString();
    }

    private void appendEpisode(StringBuilder xml, Tenant tenant, String originBaseUrl, RssEpisode rssEpisode) {
        Episode episode = rssEpisode.episode();
        xml.append("    <item>\n");
        appendElement(xml, "title", episode.getTitle(), 6);
        appendElement(xml, "link", originBaseUrl + PublicContentPaths.episodePage(episode.getSlug()), 6);
        appendDescriptionElement(xml, episode.getDescription(), 6);
        appendElement(xml, "guid", "urn:directwerk:episode:" + tenant.getSlug() + ":" + episode.getId(), 6,
                " isPermaLink=\"false\"");
        if (episode.getPublishedAt() != null) {
            appendElement(xml, "pubDate", RSS_DATE_FORMATTER.format(episode.getPublishedAt().atZone(ZoneOffset.UTC)), 6);
        }
        if (rssEpisode.coverImageUrl() != null && !rssEpisode.coverImageUrl().isBlank()) {
            appendItunesImage(xml, rssEpisode.coverImageUrl(), 6);
        }
        xml.append("      <enclosure url=\"")
                .append(escapeAttribute(rssEpisode.enclosureUrl()))
                .append("\" length=\"")
                .append(rssEpisode.length() != null ? rssEpisode.length() : 0)
                .append("\" type=\"")
                .append(escapeAttribute(rssEpisode.mimeType() != null
                        ? rssEpisode.mimeType()
                        : "application/octet-stream"))
                .append("\"/>\n");
        xml.append("    </item>\n");
    }

    private static void appendItunesImage(StringBuilder xml, String href, int spaces) {
        xml.append(" ".repeat(spaces))
                .append("<itunes:image href=\"")
                .append(escapeAttribute(href))
                .append("\"/>\n");
    }

    private static void appendItunesCategory(StringBuilder xml, String category, int spaces) {
        if (category == null || category.isBlank()) {
            return;
        }
        xml.append(" ".repeat(spaces))
                .append("<itunes:category text=\"")
                .append(escapeAttribute(category))
                .append("\"/>\n");
    }

    /**
     * Issue #319: bound the per-item description so a single imported episode (up to 512 000
     * chars) cannot dominate the document. Truncation happens on the sanitized HTML inside a
     * CDATA section, so the XML stays well-formed.
     */
    private static final int MAX_DESCRIPTION_CHARS = 4_000;

    private void appendDescriptionElement(StringBuilder xml, String value, int spaces) {
        String description = htmlSanitizer.sanitize(value);
        if (description.length() > MAX_DESCRIPTION_CHARS) {
            description = description.substring(0, MAX_DESCRIPTION_CHARS);
        }
        xml.append(" ".repeat(spaces))
                .append("<description>")
                .append(cdata(description))
                .append("</description>\n");
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

    private static String channelTitle(
            Tenant tenant,
            PodcastSeries seriesOrNull,
            List<RssEpisode> episodes,
            String channelTitleOverride
    ) {
        if (channelTitleOverride != null && !channelTitleOverride.isBlank()) {
            return channelTitleOverride;
        }
        if (seriesOrNull != null) {
            return seriesOrNull.getTitle();
        }
        if (!episodes.isEmpty()) {
            return episodes.getFirst().episode().getSeries().getTitle();
        }
        return tenant.getName();
    }

    private static String channelDescription(Tenant tenant, PodcastSeries seriesOrNull) {
        if (seriesOrNull != null && seriesOrNull.getDescription() != null) {
            return seriesOrNull.getDescription();
        }
        return tenant.getName();
    }

    private static String channelLanguage(PodcastSeries seriesOrNull, List<RssEpisode> episodes) {
        if (seriesOrNull != null) {
            return seriesOrNull.getLanguage();
        }
        if (!episodes.isEmpty()) {
            return episodes.getFirst().episode().getSeries().getLanguage();
        }
        return "de";
    }

    private static String channelItunesCategory(PodcastSeries seriesOrNull, List<RssEpisode> episodes) {
        if (seriesOrNull != null) {
            return seriesOrNull.getItunesCategory();
        }
        if (!episodes.isEmpty()) {
            return episodes.getFirst().episode().getSeries().getItunesCategory();
        }
        return null;
    }

    private static String channelExplicit(PodcastSeries seriesOrNull, List<RssEpisode> episodes) {
        PodcastSeries series = seriesOrNull;
        if (series == null && !episodes.isEmpty()) {
            series = episodes.getFirst().episode().getSeries();
        }
        return series != null && series.isItunesExplicit() ? "true" : "false";
    }

    /**
     * Issue #320: characters outside the XML 1.0 {@code Char} production (U+0000-U+0008, U+000B,
     * U+000C, U+000E-U+001F) are not legal in XML text; a single one makes the whole document
     * non-well-formed, so every subscriber's podcatcher fails on the feed.
     */
    private static final java.util.regex.Pattern INVALID_XML_CHARS =
            java.util.regex.Pattern.compile("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]");

    static String escapeText(String value) {
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
     */
    static String cdata(String value) {
        return "<![CDATA[" + value.replace("]]>", "]]]]><![CDATA[>") + "]]>";
    }

    private static String escapeAttribute(String value) {
        return escapeText(value);
    }

    public record RssEpisode(
            Episode episode,
            String enclosureUrl,
            Long length,
            String mimeType,
            String coverImageUrl
    ) {
    }
}
