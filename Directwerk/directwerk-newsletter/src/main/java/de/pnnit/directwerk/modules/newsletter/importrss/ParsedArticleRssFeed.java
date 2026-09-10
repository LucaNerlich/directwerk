package de.pnnit.directwerk.modules.newsletter.importrss;

import java.time.Instant;
import java.util.List;

public record ParsedArticleRssFeed(
        String feedUrl,
        Channel channel,
        List<Item> items
) {

    public record Channel(
            String title,
            String description,
            String language,
            String imageUrl,
            String link
    ) {
    }

    public record Item(
            String guid,
            String title,
            String bodyHtml,
            String excerpt,
            Instant publishedAt,
            String imageUrl
    ) {
    }
}
