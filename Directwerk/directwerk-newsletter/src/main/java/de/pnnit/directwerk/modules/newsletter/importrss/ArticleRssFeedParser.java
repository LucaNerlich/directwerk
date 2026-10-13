package de.pnnit.directwerk.modules.newsletter.importrss;

import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.*;

import de.pnnit.directwerk.modules.newsletter.exception.ArticleRssImportException;
import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import javax.xml.XMLConstants;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import org.springframework.stereotype.Component;

/**
 * Parses RSS 2.0 article feeds (content:encoded bodies, image enclosures).
 */
@Component
public class ArticleRssFeedParser {

    public ParsedArticleRssFeed parse(String feedUrl, InputStream xml) {
        XMLInputFactory factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        factory.setProperty(XMLInputFactory.IS_REPLACING_ENTITY_REFERENCES, false);
        setExternalAccessProperty(factory, XMLConstants.ACCESS_EXTERNAL_DTD);
        setExternalAccessProperty(factory, XMLConstants.ACCESS_EXTERNAL_SCHEMA);
        try {
            XMLStreamReader reader = factory.createXMLStreamReader(xml);
            try {
                return readDocument(feedUrl, reader);
            } finally {
                reader.close();
            }
        } catch (XMLStreamException ex) {
            throw new ArticleRssImportException(400, "RSS_FEED_INVALID", "RSS feed could not be parsed", ex);
        }
    }

    private static ParsedArticleRssFeed readDocument(String feedUrl, XMLStreamReader reader)
            throws XMLStreamException {
        String channelTitle = null;
        String channelDescription = null;
        String language = null;
        String channelImage = null;
        String link = null;
        List<ParsedArticleRssFeed.Item> items = new ArrayList<>();
        boolean inChannel = false;
        boolean inItem = false;
        boolean inImage = false;
        ItemBuilder item = null;

        while (reader.hasNext()) {
            int event = reader.next();
            if (event == XMLStreamConstants.START_ELEMENT) {
                String local = reader.getLocalName();
                if (!inChannel && "channel".equalsIgnoreCase(local)) {
                    inChannel = true;
                } else if (inChannel && !inItem && "item".equalsIgnoreCase(local)) {
                    inItem = true;
                    item = new ItemBuilder(feedUrl);
                } else if (inChannel && !inItem && "image".equalsIgnoreCase(local) && !isItunes(reader)) {
                    inImage = true;
                } else if (inItem && item != null) {
                    readItemElement(reader, item, local);
                } else if (inChannel && !inItem) {
                    if (inImage) {
                        if ("url".equalsIgnoreCase(local)) {
                            channelImage = firstNonBlank(channelImage, readElementText(reader));
                        } else {
                            skipElement(reader);
                        }
                    } else if ("title".equalsIgnoreCase(local) && !isItunes(reader)) {
                        channelTitle = firstNonBlank(channelTitle, readElementText(reader));
                    } else if ("description".equalsIgnoreCase(local) && !isItunes(reader)) {
                        channelDescription = firstNonBlank(channelDescription, readElementText(reader));
                    } else if ("language".equalsIgnoreCase(local)) {
                        language = firstNonBlank(language, readElementText(reader));
                    } else if ("link".equalsIgnoreCase(local) && !isItunes(reader)) {
                        link = firstNonBlank(link, readElementText(reader));
                    } else if ("image".equalsIgnoreCase(local) && isItunes(reader)) {
                        channelImage = firstNonBlank(channelImage, hrefAttr(reader));
                    } else {
                        skipElement(reader);
                    }
                }
            } else if (event == XMLStreamConstants.END_ELEMENT) {
                String local = reader.getLocalName();
                if (inItem && "item".equalsIgnoreCase(local)) {
                    ParsedArticleRssFeed.Item built = item == null ? null : item.build();
                    if (built != null) {
                        items.add(built);
                    }
                    item = null;
                    inItem = false;
                } else if (inImage && "image".equalsIgnoreCase(local)) {
                    inImage = false;
                } else if (inChannel && "channel".equalsIgnoreCase(local)) {
                    inChannel = false;
                }
            }
        }
        if (channelTitle == null || channelTitle.isBlank()) {
            throw new ArticleRssImportException(400, "RSS_FEED_INVALID", "RSS channel title is required");
        }
        List<ParsedArticleRssFeed.Item> resolvedItems = items.stream()
                .map(parsedItem -> new ParsedArticleRssFeed.Item(
                        parsedItem.guid(),
                        parsedItem.title(),
                        parsedItem.bodyHtml(),
                        parsedItem.excerpt(),
                        parsedItem.publishedAt(),
                        resolveHttpUrl(feedUrl, parsedItem.imageUrl())
                ))
                .toList();
        return new ParsedArticleRssFeed(
                feedUrl,
                new ParsedArticleRssFeed.Channel(
                        truncate(channelTitle.trim(), 255),
                        truncate(blankToNull(channelDescription), 20_000),
                        normalizeLanguage(language),
                        resolveHttpUrl(feedUrl, channelImage),
                        resolveHttpUrl(feedUrl, link)
                ),
                resolvedItems
        );
    }

    private static void readItemElement(XMLStreamReader reader, ItemBuilder item, String local)
            throws XMLStreamException {
        if ("title".equalsIgnoreCase(local) && !isItunes(reader)) {
            item.title = firstNonBlank(item.title, readElementText(reader));
        } else if ("description".equalsIgnoreCase(local) && !isItunes(reader)) {
            item.description = firstNonBlank(item.description, readElementText(reader));
        } else if ("encoded".equalsIgnoreCase(local) && isContentEncoded(reader)) {
            item.contentEncoded = firstNonBlank(item.contentEncoded, readElementText(reader));
        } else if ("guid".equalsIgnoreCase(local)) {
            item.guid = firstNonBlank(item.guid, readElementText(reader));
        } else if ("link".equalsIgnoreCase(local) && !isItunes(reader)) {
            item.link = firstNonBlank(item.link, readElementText(reader));
        } else if ("pubDate".equalsIgnoreCase(local)) {
            item.publishedAt = parseRfc822(readElementText(reader));
        } else if ("enclosure".equalsIgnoreCase(local)) {
            String url = attr(reader, "url");
            String mimeType = attr(reader, "type");
            if (item.imageUrl == null && isImageEnclosure(url, mimeType)) {
                item.imageUrl = blankToNull(url);
            }
        } else if ("image".equalsIgnoreCase(local) && isItunes(reader)) {
            item.imageUrl = firstNonBlank(item.imageUrl, hrefAttr(reader));
        } else {
            skipElement(reader);
        }
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

    private static final class ItemBuilder {
        private final String feedUrl;
        private String guid;
        private String title;
        private String link;
        private String description;
        private String contentEncoded;
        private Instant publishedAt;
        private String imageUrl;

        private ItemBuilder(String feedUrl) {
            this.feedUrl = feedUrl;
        }

        private ParsedArticleRssFeed.Item build() {
            if (title == null || title.isBlank()) {
                return null;
            }
            String resolvedTitle = truncate(title.trim(), 255);
            String body = firstNonBlank(contentEncoded, description);
            String excerpt = contentEncoded != null && !contentEncoded.isBlank()
                    ? blankToNull(description)
                    : null;
            if (excerpt != null && excerpt.length() > 2_000) {
                excerpt = excerpt.substring(0, 2_000).trim();
            }
            // Prefer enclosure/itunes image; fall back to first <img src> in body.
            String resolvedImage = blankToNull(imageUrl);
            if (resolvedImage == null && body != null) {
                resolvedImage = firstImgSrc(body);
            }
            String resolvedGuid = resolveImportGuid(
                    guid,
                    resolveHttpUrl(feedUrl, link),
                    resolvedTitle,
                    body,
                    publishedAt,
                    resolvedImage
            );
            return new ParsedArticleRssFeed.Item(
                    boundedGuid(resolvedGuid),
                    resolvedTitle,
                    truncate(blankToNull(body), 512_000),
                    excerpt,
                    publishedAt,
                    resolvedImage
            );
        }
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
