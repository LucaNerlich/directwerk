package de.pnnit.directwerk.modules.digital.importing;

import java.time.Instant;
import java.util.List;

/**
 * Raw RSS 2.0 document as read by {@link RssFeedReader}, before any module-specific
 * field policy (audio vs. image enclosure, GUID fallback, body projection) is applied.
 * Each item keeps every enclosure so a module can pick the one its content type needs.
 */
public record ParsedRssDocument(
        String feedUrl,
        Channel channel,
        List<Item> items
) {

    public record Channel(
            String title,
            String description,
            String language,
            String itunesCategory,
            String imageUrl,
            String link
    ) {
    }

    public record Item(
            String guid,
            String title,
            String link,
            String description,
            String itunesSummary,
            String contentEncoded,
            Instant publishedAt,
            List<Enclosure> enclosures,
            Integer durationSeconds,
            Integer episodeNumber,
            String imageUrl
    ) {
    }

    public record Enclosure(
            String url,
            String mimeType,
            Long length
    ) {
    }
}
