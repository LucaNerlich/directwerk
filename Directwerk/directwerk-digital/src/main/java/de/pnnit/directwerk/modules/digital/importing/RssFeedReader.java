package de.pnnit.directwerk.modules.digital.importing;

import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.attr;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.firstNonBlank;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.hrefAttr;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.isContentEncoded;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.isItunes;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.parseDuration;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.parsePositiveInt;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.parsePositiveLong;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.readElementText;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.setExternalAccessProperty;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.skipElement;

import de.pnnit.directwerk.modules.digital.exception.RssFeedImportException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import javax.xml.XMLConstants;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

/**
 * Reads an RSS 2.0 document into a generic {@link ParsedRssDocument}.
 *
 * <p>This is the single XML walk for the podcast and newsletter importers: channel
 * metadata plus every item field and enclosure they may need. Content-type policy
 * (which enclosure counts, how a missing GUID is derived, how a body is projected)
 * stays in the module adapter, so both pipelines cannot drift on XXE hardening or
 * element handling.</p>
 */
public final class RssFeedReader {

    private static final String INVALID_FEED_CODE = "RSS_FEED_INVALID";

    private RssFeedReader() {
    }

    /**
     * Parses an RSS 2.0 document.
     *
     * @param feedUrl the feed URL used later to resolve relative links
     * @param xml     the RSS XML input
     * @return the parsed document
     * @throws RssFeedImportException if the XML is malformed or the channel has no title
     */
    public static ParsedRssDocument parse(String feedUrl, InputStream xml) {
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
            throw new RssFeedImportException(400, INVALID_FEED_CODE, "RSS feed could not be parsed", ex);
        }
    }

    private static ParsedRssDocument readDocument(String feedUrl, XMLStreamReader reader)
            throws XMLStreamException {
        String channelTitle = null;
        String channelDescription = null;
        String language = null;
        String itunesCategory = null;
        String channelImage = null;
        String link = null;
        List<ParsedRssDocument.Item> items = new ArrayList<>();
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
                        itunesCategory = firstNonBlank(itunesCategory, readItunesCategory(reader));
                    } else if ("image".equalsIgnoreCase(local) && isItunes(reader)) {
                        channelImage = firstNonBlank(channelImage, hrefAttr(reader));
                    } else {
                        skipElement(reader);
                    }
                }
            } else if (event == XMLStreamConstants.END_ELEMENT) {
                String local = reader.getLocalName();
                if (inItem && "item".equalsIgnoreCase(local)) {
                    if (item != null) {
                        items.add(item.build());
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
            throw new RssFeedImportException(400, INVALID_FEED_CODE, "RSS channel title is required");
        }
        return new ParsedRssDocument(
                feedUrl,
                new ParsedRssDocument.Channel(
                        channelTitle,
                        channelDescription,
                        language,
                        itunesCategory,
                        channelImage,
                        link
                ),
                List.copyOf(items)
        );
    }

    private static void readItemElement(XMLStreamReader reader, ItemBuilder item, String local)
            throws XMLStreamException {
        if ("title".equalsIgnoreCase(local) && !isItunes(reader)) {
            item.title = firstNonBlank(item.title, readElementText(reader));
        } else if ("description".equalsIgnoreCase(local) && !isItunes(reader)) {
            item.description = firstNonBlank(item.description, readElementText(reader));
        } else if ("summary".equalsIgnoreCase(local) && isItunes(reader)) {
            item.itunesSummary = firstNonBlank(item.itunesSummary, readElementText(reader));
        } else if ("encoded".equalsIgnoreCase(local) && isContentEncoded(reader)) {
            item.contentEncoded = firstNonBlank(item.contentEncoded, readElementText(reader));
        } else if ("guid".equalsIgnoreCase(local)) {
            item.guid = firstNonBlank(item.guid, readElementText(reader));
        } else if ("link".equalsIgnoreCase(local) && !isItunes(reader)) {
            item.link = firstNonBlank(item.link, readElementText(reader));
        } else if ("pubDate".equalsIgnoreCase(local)) {
            item.publishedAt = RssFeedSupport.parseRfc822(readElementText(reader));
        } else if ("enclosure".equalsIgnoreCase(local)) {
            item.enclosures.add(new ParsedRssDocument.Enclosure(
                    RssFeedSupport.blankToNull(attr(reader, "url")),
                    RssFeedSupport.blankToNull(attr(reader, "type")),
                    parsePositiveLong(attr(reader, "length"))
            ));
        } else if ("duration".equalsIgnoreCase(local) && isItunes(reader)) {
            item.durationSeconds = parseDuration(readElementText(reader));
        } else if ("episode".equalsIgnoreCase(local) && isItunes(reader)) {
            item.episodeNumber = parsePositiveInt(readElementText(reader));
        } else if ("image".equalsIgnoreCase(local) && isItunes(reader)) {
            item.imageUrl = firstNonBlank(item.imageUrl, hrefAttr(reader));
        } else {
            skipElement(reader);
        }
    }

    /**
     * Reads an iTunes category from its {@code text} attribute or element content.
     */
    private static String readItunesCategory(XMLStreamReader reader) throws XMLStreamException {
        String text = attr(reader, "text");
        if (text != null && !text.isBlank()) {
            skipElement(reader);
            return text.trim();
        }
        return readElementText(reader);
    }

    private static final class ItemBuilder {
        private String guid;
        private String title;
        private String link;
        private String description;
        private String itunesSummary;
        private String contentEncoded;
        private java.time.Instant publishedAt;
        private final List<ParsedRssDocument.Enclosure> enclosures = new ArrayList<>();
        private Integer durationSeconds;
        private Integer episodeNumber;
        private String imageUrl;

        private ParsedRssDocument.Item build() {
            return new ParsedRssDocument.Item(
                    guid,
                    title,
                    link,
                    description,
                    itunesSummary,
                    contentEncoded,
                    publishedAt,
                    List.copyOf(enclosures),
                    durationSeconds,
                    episodeNumber,
                    imageUrl
            );
        }
    }
}
