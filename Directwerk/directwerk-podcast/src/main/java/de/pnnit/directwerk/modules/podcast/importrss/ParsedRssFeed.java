package de.pnnit.directwerk.modules.podcast.importrss;

import java.time.Instant;
import java.util.List;

public record ParsedRssFeed(
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
            String description,
            Instant publishedAt,
            Integer durationSeconds,
            Integer episodeNumber,
            String audioUrl,
            String audioMimeType,
            Long audioSizeBytes,
            String imageUrl
    ) {
    }
}
