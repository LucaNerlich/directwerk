package de.pnnit.directwerk.modules.newsletter.importrss;

import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.blankToNull;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.boundedGuid;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.firstNonBlank;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.normalizeLanguage;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.resolveHttpUrl;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.sha256Hex;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.truncate;

import de.pnnit.directwerk.modules.digital.exception.RssFeedImportException;
import de.pnnit.directwerk.modules.digital.importing.ImportedTextLimits;
import de.pnnit.directwerk.modules.digital.importing.ParsedRssDocument;
import de.pnnit.directwerk.modules.digital.importing.RssFeedReader;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleRssImportException;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.springframework.stereotype.Component;

/**
 * Maps a generic {@link ParsedRssDocument} onto article fields: content:encoded body,
 * teaser excerpt, image enclosure (with inline-image fallback) and a stable import GUID.
 */
@Component
public class ArticleRssFeedParser {

    /**
     * Parses an RSS feed and converts it into a structured article feed representation.
     *
     * @param feedUrl the feed URL used to resolve relative links
     * @param xml     the RSS XML input
     * @return        the parsed article feed
     * @throws ArticleRssImportException if the XML is malformed or the feed is invalid
     */
    public ParsedArticleRssFeed parse(String feedUrl, InputStream xml) {
        ParsedRssDocument document;
        try {
            document = RssFeedReader.parse(feedUrl, xml);
        } catch (RssFeedImportException ex) {
            throw new ArticleRssImportException(ex.getStatus(), ex.getCode(), ex.getMessage(), ex);
        }
        List<ParsedArticleRssFeed.Item> items = document.items().stream()
                .map(item -> toItem(feedUrl, item))
                .filter(Objects::nonNull)
                .toList();
        ParsedRssDocument.Channel channel = document.channel();
        return new ParsedArticleRssFeed(
                feedUrl,
                new ParsedArticleRssFeed.Channel(
                        truncate(channel.title().trim(), 255),
                        truncate(blankToNull(channel.description()), 20_000),
                        normalizeLanguage(channel.language()),
                        resolveHttpUrl(feedUrl, channel.imageUrl()),
                        resolveHttpUrl(feedUrl, channel.link())
                ),
                items
        );
    }

    private static ParsedArticleRssFeed.Item toItem(String feedUrl, ParsedRssDocument.Item parsed) {
        if (parsed.title() == null || parsed.title().isBlank()) {
            return null;
        }
        String resolvedTitle = truncate(parsed.title().trim(), 255);
        String body = firstNonBlank(parsed.contentEncoded(), parsed.description());
        String excerpt = parsed.contentEncoded() != null && !parsed.contentEncoded().isBlank()
                ? blankToNull(parsed.description())
                : null;
        if (excerpt != null && excerpt.length() > 2_000) {
            excerpt = excerpt.substring(0, 2_000).trim();
        }
        // Prefer an image enclosure or itunes image; fall back to first <img src> in body.
        String resolvedImage = firstImageUrl(parsed);
        if (resolvedImage == null && body != null) {
            resolvedImage = firstImgSrc(body);
        }
        String resolvedGuid = resolveImportGuid(
                parsed.guid(),
                resolveHttpUrl(feedUrl, parsed.link()),
                resolvedTitle,
                body,
                parsed.publishedAt(),
                resolvedImage
        );
        return new ParsedArticleRssFeed.Item(
                boundedGuid(resolvedGuid),
                resolvedTitle,
                truncate(blankToNull(body), ImportedTextLimits.BODY_MAX),
                excerpt,
                parsed.publishedAt(),
                resolveHttpUrl(feedUrl, resolvedImage)
        );
    }

    private static String firstImageUrl(ParsedRssDocument.Item parsed) {
        for (ParsedRssDocument.Enclosure enclosure : parsed.enclosures()) {
            if (isImageEnclosure(enclosure.url(), enclosure.mimeType())) {
                return blankToNull(enclosure.url());
            }
        }
        return blankToNull(parsed.imageUrl());
    }

    private static boolean isImageEnclosure(String url, String mimeType) {
        if (url == null || url.isBlank()) {
            return false;
        }
        if (mimeType != null && !mimeType.isBlank()) {
            String normalized = mimeType.trim().toLowerCase(Locale.ROOT);
            if (normalized.startsWith("image/")) {
                return true;
            }
            if (normalized.startsWith("audio/") || normalized.startsWith("video/")) {
                return false;
            }
        }
        String lower = url.toLowerCase(Locale.ROOT);
        return lower.endsWith(".jpg")
                || lower.endsWith(".jpeg")
                || lower.endsWith(".png")
                || lower.endsWith(".webp")
                || lower.endsWith(".gif")
                || lower.contains(".jpg?")
                || lower.contains(".jpeg?")
                || lower.contains(".png?")
                || lower.contains(".webp?");
    }

    /**
     * Prefer feed GUID, then item permalink; never fall back to title alone.
     */
    static String resolveImportGuid(
            String guid,
            String permalink,
            String title,
            String body,
            Instant publishedAt,
            String imageUrl
    ) {
        if (guid != null && !guid.isBlank()) {
            return guid;
        }
        if (permalink != null && !permalink.isBlank()) {
            return permalink;
        }
        return stableFallbackIdentity(title, body, publishedAt, imageUrl);
    }

    private static String stableFallbackIdentity(
            String title,
            String body,
            Instant publishedAt,
            String imageUrl
    ) {
        String material = String.join(
                "\n",
                title == null ? "" : title.trim(),
                publishedAt == null ? "" : publishedAt.toString(),
                body == null ? "" : body.trim(),
                imageUrl == null ? "" : imageUrl.trim()
        );
        return "sha256:" + sha256Hex(material);
    }

    static String firstImgSrc(String html) {
        if (html == null || html.isBlank()) {
            return null;
        }
        java.util.regex.Matcher matcher = IMG_SRC.matcher(html);
        if (matcher.find()) {
            return blankToNull(matcher.group(1));
        }
        return null;
    }

    private static final java.util.regex.Pattern IMG_SRC = java.util.regex.Pattern.compile(
            "<img\\b[^>]*\\bsrc\\s*=\\s*[\"']([^\"']+)[\"']",
            java.util.regex.Pattern.CASE_INSENSITIVE
    );
}
