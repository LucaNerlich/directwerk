package de.pnnit.directwerk.modules.podcast.importrss;

import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.*;

import de.pnnit.directwerk.modules.podcast.exception.RssImportException;
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
 * Parses RSS 2.0 podcast feeds, including common iTunes extensions.
 */
@Component
public class RssFeedParser {

    /**
     * Parses an RSS feed and converts it into a structured feed representation.
     *
     * @param feedUrl the feed URL used to resolve relative links
     * @param xml     the RSS XML input
     * @return        the parsed RSS feed
     * @throws RssImportException if the XML is malformed or the feed is invalid
     */
    public ParsedRssFeed parse(String feedUrl, InputStream xml) {
        XMLInputFactory factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        factory.setProperty(XMLInputFactory.IS_REPLACING_ENTITY_REFERENCES, false);
        // Defense in depth: some StAX implementations honor JAXP external-access properties
        // even with DTD support disabled — deny external DTD/schema resolution outright.
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
            throw new RssImportException(400, "RSS_FEED_INVALID", "RSS feed could not be parsed", ex);
        }
    }

    /**
     * Reads channel metadata and podcast items from an RSS document.
     *
     * @param feedUrl the URL of the feed, used to resolve relative channel and item URLs
     * @param reader  the XML reader positioned at the start of the document
     * @return        the parsed RSS feed with validated and resolved channel and item data
     * @throws XMLStreamException if the XML document cannot be read
     */
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

    /**
     * Reads a podcast item's metadata from the current XML element.
     *
     * @param reader the XML stream reader positioned at the item element
     * @param item   the item being populated
     * @param local  the current element's local name
     * @throws XMLStreamException if reading element content fails
     */
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

    /**
     * Reads an iTunes category from its {@code text} attribute or element content.
     *
     * @param reader the XML reader positioned at the iTunes category element
     * @return the trimmed category text, or {@code null} when the element has no content
     * @throws XMLStreamException if the category element cannot be read
     */
    private static String readItunesCategory(XMLStreamReader reader) throws XMLStreamException {
        String text = attr(reader, "text");
        if (text != null && !text.isBlank()) {
            skipElement(reader);
            return text.trim();
        }
        return readElementText(reader);
    }

    /**
     * Determines whether an enclosure has a usable URL and an audio-compatible MIME type.
     *
     * @param url      the enclosure URL
     * @param mimeType the enclosure MIME type
     * @return {@code true} if the URL is present and the MIME type is audio-compatible or unspecified,
     *         {@code false} otherwise
     */
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

    /**
     * Parses a duration expressed as seconds or colon-separated time units.
     *
     * @param raw the duration text to parse
     * @return the positive duration in seconds, or {@code null} for invalid, non-positive, or overflowing values
     */
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
                seconds = Math.addExact(Math.multiplyExact(seconds, 60), Integer.parseInt(part.trim()));
            }
            return seconds > 0 ? seconds : null;
        } catch (NumberFormatException | ArithmeticException ex) {
            return null;
        }
    }

    /**
     * Parses a string as a positive integer.
     *
     * @param raw the string to parse
     * @return the parsed integer when it is greater than zero; {@code null} otherwise
     */
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

    /**
     * Parses a positive long value from text.
     *
     * @param raw the text to parse
     * @return the parsed value if it is positive and valid, or {@code null} otherwise
     */
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

        /**
         * Builds a parsed podcast item from the collected episode fields.
         *
         * @return the parsed item, or {@code null} if both the title and audio URL are blank
         */
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
