package de.pnnit.directwerk.modules.podcast.importrss;

import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.blankToNull;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.boundedGuid;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.firstNonBlank;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.normalizeLanguage;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.resolveHttpUrl;
import static de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.truncate;

import de.pnnit.directwerk.modules.digital.exception.RssFeedImportException;
import de.pnnit.directwerk.modules.digital.importing.ParsedRssDocument;
import de.pnnit.directwerk.modules.digital.importing.RssFeedReader;
import de.pnnit.directwerk.modules.podcast.exception.RssImportException;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.springframework.stereotype.Component;

/**
 * Maps a generic {@link ParsedRssDocument} onto podcast episode fields: audio
 * enclosures only, episode numbering, show-notes and artwork.
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
        ParsedRssDocument document;
        try {
            document = RssFeedReader.parse(feedUrl, xml);
        } catch (RssFeedImportException ex) {
            throw new RssImportException(ex.getStatus(), ex.getCode(), ex.getMessage(), ex);
        }
        List<ParsedRssFeed.Item> items = document.items().stream()
                .map(item -> toItem(feedUrl, item))
                .filter(Objects::nonNull)
                .toList();
        ParsedRssDocument.Channel channel = document.channel();
        return new ParsedRssFeed(
                feedUrl,
                new ParsedRssFeed.Channel(
                        truncate(channel.title().trim(), 255),
                        truncate(blankToNull(channel.description()), 20_000),
                        normalizeLanguage(channel.language()),
                        truncate(blankToNull(channel.itunesCategory()), 128),
                        resolveHttpUrl(feedUrl, channel.imageUrl()),
                        resolveHttpUrl(feedUrl, channel.link())
                ),
                items
        );
    }

    private static ParsedRssFeed.Item toItem(String feedUrl, ParsedRssDocument.Item parsed) {
        ParsedRssDocument.Enclosure audio = firstAudioEnclosure(parsed);
        boolean hasTitle = parsed.title() != null && !parsed.title().isBlank();
        if (!hasTitle && audio == null) {
            return null;
        }
        String resolvedTitle = hasTitle ? truncate(parsed.title().trim(), 255) : "Untitled episode";
        String resolvedGuid = parsed.guid() == null || parsed.guid().isBlank()
                ? (audio == null || audio.url() == null ? resolvedTitle : audio.url())
                : parsed.guid();
        String description = truncate(
                blankToNull(firstNonBlank(
                        parsed.contentEncoded(),
                        firstNonBlank(parsed.description(), parsed.itunesSummary()))),
                512_000
        );
        return new ParsedRssFeed.Item(
                boundedGuid(resolvedGuid),
                resolvedTitle,
                description,
                parsed.publishedAt(),
                parsed.durationSeconds(),
                parsed.episodeNumber(),
                audio == null ? null : resolveHttpUrl(feedUrl, audio.url()),
                audio == null ? null : truncate(audio.mimeType(), 128),
                audio == null ? null : audio.length(),
                resolveHttpUrl(feedUrl, parsed.imageUrl())
        );
    }

    private static ParsedRssDocument.Enclosure firstAudioEnclosure(ParsedRssDocument.Item parsed) {
        for (ParsedRssDocument.Enclosure enclosure : parsed.enclosures()) {
            if (isAudioEnclosure(enclosure.url(), enclosure.mimeType())) {
                return enclosure;
            }
        }
        return null;
    }

    /**
     * Determines whether an enclosure has a usable URL and an audio-compatible MIME type.
     *
     * @param url      the enclosure URL
     * @param mimeType the enclosure MIME type
     * @return {@code true} if the URL is present and the MIME type is audio-compatible or unspecified
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
     * @return the positive duration in seconds, or {@code null} for invalid values
     */
    static Integer parseDuration(String raw) {
        return de.pnnit.directwerk.modules.digital.importing.RssFeedSupport.parseDuration(raw);
    }
}
