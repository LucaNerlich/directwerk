package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class RssXmlBuilder {

    private static final DateTimeFormatter RSS_DATE_FORMATTER = DateTimeFormatter.RFC_1123_DATE_TIME;

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
        StringBuilder xml = new StringBuilder(4096);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<rss version=\"2.0\">\n");
        xml.append("  <channel>\n");
        appendElement(xml, "title", channelTitle(tenant, seriesOrNull, episodes), 4);
        appendElement(xml, "link", originBaseUrl, 4);
        appendElement(xml, "description", channelDescription(tenant, seriesOrNull), 4);
        appendElement(xml, "language", channelLanguage(seriesOrNull, episodes), 4);
        for (RssEpisode rssEpisode : episodes) {
            appendEpisode(xml, tenant, rssEpisode);
        }
        xml.append("  </channel>\n");
        xml.append("</rss>\n");
        return xml.toString();
    }

    private static void appendEpisode(StringBuilder xml, Tenant tenant, RssEpisode rssEpisode) {
        Episode episode = rssEpisode.episode();
        xml.append("    <item>\n");
        appendElement(xml, "title", episode.getTitle(), 6);
        appendElement(xml, "description", episode.getDescription(), 6);
        appendElement(xml, "guid", "urn:directwerk:episode:" + tenant.getSlug() + ":" + episode.getId(), 6,
                " isPermaLink=\"false\"");
        if (episode.getPublishedAt() != null) {
            appendElement(xml, "pubDate", RSS_DATE_FORMATTER.format(episode.getPublishedAt().atZone(ZoneOffset.UTC)), 6);
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

    private static String channelTitle(Tenant tenant, PodcastSeries seriesOrNull, List<RssEpisode> episodes) {
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

    static String escapeText(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static String escapeAttribute(String value) {
        return escapeText(value);
    }

    public record RssEpisode(Episode episode, String enclosureUrl, Long length, String mimeType) {
    }
}
