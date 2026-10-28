package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.content.PublicContentPaths;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.importing.RssXmlWriter;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Podcast RSS 2.0 feed: iTunes channel metadata plus one enclosure per episode.
 * The XML shape lives in {@link RssXmlWriter}; this class only projects episodes.
 */
@Component
@RequiredArgsConstructor
public class RssXmlBuilder {

    /**
     * Issue #319: bound the per-item description so a single imported episode (up to 512 000
     * chars) cannot dominate the document. Truncation happens on the sanitized HTML inside a
     * CDATA section, so the XML stays well-formed.
     */
    private static final int MAX_DESCRIPTION_CHARS = 4_000;

    private final HtmlSanitizer htmlSanitizer;

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
            String originBaseUrl,
            String channelTitleOverride,
            String channelCoverImageUrl
    ) {
        RssXmlWriter.Channel channel = new RssXmlWriter.Channel(
                channelTitle(tenant, seriesOrNull, episodes, channelTitleOverride),
                originBaseUrl,
                channelDescription(tenant, seriesOrNull),
                channelLanguage(seriesOrNull, episodes),
                true,
                channelItunesCategory(seriesOrNull, episodes),
                channelExplicit(seriesOrNull, episodes),
                channelCoverImageUrl,
                MAX_DESCRIPTION_CHARS,
                tenant.getContactEmail(),
                tenant.getName()
        );
        return RssXmlWriter.build(
                channel,
                episodes,
                rssEpisode -> toItem(tenant, originBaseUrl, rssEpisode),
                htmlSanitizer::sanitize
        );
    }

    private RssXmlWriter.Item toItem(Tenant tenant, String originBaseUrl, RssEpisode rssEpisode) {
        Episode episode = rssEpisode.episode();
        return new RssXmlWriter.Item(
                episode.getTitle(),
                originBaseUrl + PublicContentPaths.episodePath(episode.getSlug()),
                episode.getDescription(),
                "urn:directwerk:episode:" + tenant.getSlug() + ":" + episode.getId(),
                episode.getPublishedAt(),
                rssEpisode.coverImageUrl(),
                rssEpisode.enclosureUrl(),
                rssEpisode.length(),
                rssEpisode.mimeType()
        );
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

    private static boolean channelExplicit(PodcastSeries seriesOrNull, List<RssEpisode> episodes) {
        PodcastSeries series = seriesOrNull;
        if (series == null && !episodes.isEmpty()) {
            series = episodes.getFirst().episode().getSeries();
        }
        return series != null && series.isItunesExplicit();
    }

    static String escapeText(String value) {
        return RssXmlWriter.escapeText(value);
    }

    static String cdata(String value) {
        return RssXmlWriter.cdata(value);
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
