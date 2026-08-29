package de.pnnit.directwerk.modules.podcast.importrss;

import de.pnnit.directwerk.modules.podcast.exception.RssImportException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import org.springframework.stereotype.Component;

/**
 * Parses RSS 2.0 podcast feeds, including common iTunes extensions.
 */
@Component
public class RssFeedParser {

    static final String ITUNES_NS = "http://www.itunes.com/dtds/podcast-1.0.dtd";
    static final String CONTENT_NS = "http://purl.org/rss/1.0/modules/content/";

    public ParsedRssFeed parse(String feedUrl, InputStream xml) {
        XMLInputFactory factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        factory.setProperty(XMLInputFactory.IS_REPLACING_ENTITY_REFERENCES, false);
        try {
            XMLStreamReader reader = factory.createXMLStreamReader(xml);
            try {
                return readDocument(feedUrl, reader);
            } finally {
                reader.close();
            }
        } catch (XMLStreamException ex) {
            throw new RssImportException(400, "RSS_FEED_INVALID", "RSS feed could not be parsed", ex);
        }
    }

    private static ParsedRssFeed readDocument(String feedUrl, XMLStreamReader reader) throws XMLStreamException {
        String channelTitle = null;
        String channelDescription = null;
        String language = null;
        String itunesCategory = null;
        String channelImage = null;
        String link = null;
        List<ParsedRssFeed.Item> items = new ArrayList<>();
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
                    item = new ItemBuilder();
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
                    } else if ("category".equalsIgnoreCase(local) && isItunes(reader)) {
                        String text = readItunesCategory(reader);
                        itunesCategory = firstNonBlank(itunesCategory, text);
                    } else if ("image".equalsIgnoreCase(local) && isItunes(reader)) {
                        channelImage = firstNonBlank(channelImage, hrefAttr(reader));
                    }
                }
            } else if (event == XMLStreamConstants.END_ELEMENT) {
                String local = reader.getLocalName();
                if (inItem && "item".equalsIgnoreCase(local)) {
                    ParsedRssFeed.Item built = item == null ? null : item.build();
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
            throw new RssImportException(400, "RSS_FEED_INVALID", "RSS channel title is required");
        }
        List<ParsedRssFeed.Item> resolvedItems = items.stream()
                .map(parsedItem -> new ParsedRssFeed.Item(
                        parsedItem.guid(),
                        parsedItem.title(),
                        parsedItem.description(),
                        parsedItem.publishedAt(),
                        parsedItem.durationSeconds(),
                        parsedItem.episodeNumber(),
                        resolveHttpUrl(feedUrl, parsedItem.audioUrl()),
                        parsedItem.audioMimeType(),
                        parsedItem.audioSizeBytes(),
                        resolveHttpUrl(feedUrl, parsedItem.imageUrl())
                ))
                .toList();
        return new ParsedRssFeed(
                feedUrl,
                new ParsedRssFeed.Channel(
                        truncate(channelTitle.trim(), 255),
                        truncate(blankToNull(channelDescription), 20_000),
                        normalizeLanguage(language),
                        truncate(blankToNull(itunesCategory), 128),
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
        } else if ("summary".equalsIgnoreCase(local) && isItunes(reader) && item.description == null) {
            item.description = readElementText(reader);
        } else if ("encoded".equalsIgnoreCase(local) && isContentEncoded(reader)) {
            item.contentEncoded = firstNonBlank(item.contentEncoded, readElementText(reader));
        } else if ("guid".equalsIgnoreCase(local)) {
            item.guid = firstNonBlank(item.guid, readElementText(reader));
        } else if ("pubDate".equalsIgnoreCase(local)) {
            item.publishedAt = parseRfc822(readElementText(reader));
        } else if ("enclosure".equalsIgnoreCase(local)) {
            String url = attr(reader, "url");
            String mimeType = attr(reader, "type");
            if (item.audioUrl == null && isAudioEnclosure(url, mimeType)) {
                item.audioUrl = blankToNull(url);
                item.audioMimeType = blankToNull(mimeType);
                item.audioSizeBytes = parseLong(attr(reader, "length"));
            }
        } else if ("duration".equalsIgnoreCase(local) && isItunes(reader)) {
            item.durationSeconds = parseDuration(readElementText(reader));
        } else if ("episode".equalsIgnoreCase(local) && isItunes(reader)) {
            item.episodeNumber = parsePositiveInt(readElementText(reader));
        } else if ("image".equalsIgnoreCase(local) && isItunes(reader)) {
            item.imageUrl = firstNonBlank(item.imageUrl, hrefAttr(reader));
        }
    }

    private static String readItunesCategory(XMLStreamReader reader) throws XMLStreamException {
        String text = attr(reader, "text");
        if (text != null && !text.isBlank()) {
            skipElement(reader);
            return text.trim();
        }
        return readElementText(reader);
    }

    private static void skipElement(XMLStreamReader reader) throws XMLStreamException {
        int depth = 1;
        while (depth > 0 && reader.hasNext()) {
            int event = reader.next();
            if (event == XMLStreamConstants.START_ELEMENT) {
                depth++;
            } else if (event == XMLStreamConstants.END_ELEMENT) {
                depth--;
            }
        }
    }

    private static String readElementText(XMLStreamReader reader) throws XMLStreamException {
        return reader.getElementText();
    }

    private static boolean isItunes(XMLStreamReader reader) {
        String ns = reader.getNamespaceURI();
        return "itunes".equalsIgnoreCase(reader.getPrefix())
                || (ns != null && (
                        ITUNES_NS.equalsIgnoreCase(ns)
                                || ns.toLowerCase(Locale.ROOT).contains("itunes.com/dtds/podcast-1.0.dtd")
                ));
    }

    private static boolean isContentEncoded(XMLStreamReader reader) {
        String ns = reader.getNamespaceURI();
        return "content".equalsIgnoreCase(reader.getPrefix())
                || (ns != null && CONTENT_NS.equalsIgnoreCase(ns));
    }

    private static boolean isAudioEnclosure(String url, String mimeType) {
        if (url == null || url.isBlank()) {
            return false;
        }
        if (mimeType == null || mimeType.isBlank()) {
            return true;
        }
        String normalized = mimeType.trim().toLowerCase(Locale.ROOT);
        return normalized.startsWith("audio/")
                || "application/octet-stream".equals(normalized);
    }

    private static String resolveHttpUrl(String feedUrl, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            URI resolved = URI.create(feedUrl).resolve(value.trim());
            String scheme = resolved.getScheme();
            if (resolved.getHost() == null
                    || scheme == null
                    || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
                return null;
            }
            String result = resolved.toString();
            return result.length() <= 2048 ? result : null;
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String hrefAttr(XMLStreamReader reader) {
        return firstNonBlank(attr(reader, "href"), attr(reader, "url"));
    }

    private static String attr(XMLStreamReader reader, String name) {
        String value = reader.getAttributeValue(null, name);
        if (value != null) {
            return value;
        }
        for (int i = 0; i < reader.getAttributeCount(); i++) {
            if (name.equalsIgnoreCase(reader.getAttributeLocalName(i))) {
                return reader.getAttributeValue(i);
            }
        }
        return null;
    }

    static Instant parseRfc822(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return ZonedDateTime.parse(raw.trim(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
        } catch (DateTimeParseException ignored) {
            try {
                return ZonedDateTime.parse(raw.trim(), DateTimeFormatter.RFC_1123_DATE_TIME.withLocale(Locale.US))
                        .toInstant();
            } catch (DateTimeParseException ex) {
                return null;
            }
        }
    }

    static Integer parseDuration(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        if (value.chars().allMatch(Character::isDigit)) {
            try {
                int seconds = Integer.parseInt(value);
                return seconds > 0 ? seconds : null;
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        String[] parts = value.split(":");
        try {
            int seconds = 0;
            for (String part : parts) {
                seconds = Math.addExact(Math.multiplyExact(seconds, 60), Integer.parseInt(part));
            }
            return seconds > 0 ? seconds : null;
        } catch (NumberFormatException | ArithmeticException ex) {
            return null;
        }
    }

    private static Integer parsePositiveInt(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            int value = Integer.parseInt(raw.trim());
            return value > 0 ? value : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static Long parseLong(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            long value = Long.parseLong(raw.trim());
            return value > 0 ? value : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String normalizeLanguage(String language) {
        if (language == null || language.isBlank()) {
            return "de";
        }
        String trimmed = language.trim();
        return trimmed.length() > 8 ? trimmed.substring(0, 8) : trimmed;
    }

    private static String firstNonBlank(String current, String candidate) {
        if (current != null && !current.isBlank()) {
            return current;
        }
        return candidate;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength).trim();
    }

    private static String boundedGuid(String value) {
        String guid = value.trim();
        if (guid.length() <= 512) {
            return guid;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return "sha256:" + HexFormat.of().formatHex(
                    digest.digest(guid.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private static final class ItemBuilder {
        private String guid;
        private String title;
        private String description;
        private String contentEncoded;
        private Instant publishedAt;
        private Integer durationSeconds;
        private Integer episodeNumber;
        private String audioUrl;
        private String audioMimeType;
        private Long audioSizeBytes;
        private String imageUrl;

        private ParsedRssFeed.Item build() {
            if ((title == null || title.isBlank()) && (audioUrl == null || audioUrl.isBlank())) {
                return null;
            }
            String resolvedTitle = title == null || title.isBlank()
                    ? "Untitled episode"
                    : truncate(title.trim(), 255);
            String resolvedGuid = guid == null || guid.isBlank()
                    ? (audioUrl == null ? resolvedTitle : audioUrl)
                    : guid;
            return new ParsedRssFeed.Item(
                    boundedGuid(resolvedGuid),
                    resolvedTitle,
                    truncate(blankToNull(firstNonBlank(contentEncoded, description)), 512_000),
                    publishedAt,
                    durationSeconds,
                    episodeNumber,
                    blankToNull(audioUrl),
                    truncate(blankToNull(audioMimeType), 128),
                    audioSizeBytes,
                    blankToNull(imageUrl)
            );
        }
    }
}
