package de.pnnit.directwerk.modules.digital.importing;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.Locale;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

/**
 * Low-level RSS document reading and field-bounding helpers shared by the
 * podcast episode and newsletter article feed parsers.
 *
 * <p>Both importers walk the same XML shape (channel metadata plus items) and
 * apply the same URL, language, GUID and length rules. Keeping one
 * implementation means an XXE-hardening or field-bound fix lands in both
 * pipelines at once. Each parser keeps its own exception type and item model;
 * these helpers never raise a module exception.</p>
 */
public final class RssFeedSupport {

    private static final String ITUNES_NS = "http://www.itunes.com/dtds/podcast-1.0.dtd";
    private static final String CONTENT_NS = "http://purl.org/rss/1.0/modules/content/";
    private static final int MAX_URL_LENGTH = 2048;
    private static final int MAX_GUID_LENGTH = 512;

    private RssFeedSupport() {
    }

    /** Disables a JAXP external-access property, ignoring runtimes that reject it. */
    public static void setExternalAccessProperty(XMLInputFactory factory, String name) {
        try {
            factory.setProperty(name, "");
        } catch (IllegalArgumentException unsupported) {
            // Implementation does not recognize the JAXP property — the DTD/external-entity
            // flags set by the caller already provide the XXE protection on such runtimes.
        }
    }

    /**
     * Skips the current XML element and all nested content.
     *
     * @param reader the XML stream reader positioned at the element to skip
     * @throws XMLStreamException if the XML stream cannot be advanced
     */
    public static void skipElement(XMLStreamReader reader) throws XMLStreamException {
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

    /**
     * Reads the text content of the current element.
     *
     * @param reader the XML stream reader positioned at the element
     * @return the element text
     * @throws XMLStreamException if reading the element content fails
     */
    public static String readElementText(XMLStreamReader reader) throws XMLStreamException {
        return reader.getElementText();
    }

    /**
     * Whether the current XML element belongs to the iTunes namespace.
     *
     * @param reader the XML stream reader positioned at the current element
     * @return {@code true} if the element uses the iTunes prefix or namespace
     */
    public static boolean isItunes(XMLStreamReader reader) {
        String ns = reader.getNamespaceURI();
        return "itunes".equalsIgnoreCase(reader.getPrefix())
                || (ns != null && (
                        ITUNES_NS.equalsIgnoreCase(ns)
                                || ns.toLowerCase(Locale.ROOT).contains("itunes.com/dtds/podcast-1.0.dtd")
                ));
    }

    /**
     * Whether the current XML element represents content-encoded content.
     *
     * @param reader the XML stream reader positioned at the current element
     * @return {@code true} if the element uses the content prefix or namespace
     */
    public static boolean isContentEncoded(XMLStreamReader reader) {
        String ns = reader.getNamespaceURI();
        return "content".equalsIgnoreCase(reader.getPrefix())
                || (ns != null && CONTENT_NS.equalsIgnoreCase(ns));
    }

    /**
     * Resolves a URL against the feed URL, accepting only bounded HTTP(S) URLs.
     *
     * @param feedUrl the base URL used to resolve relative values
     * @param value   the URL value to resolve
     * @return the resolved URL, or {@code null} when blank, invalid, hostless or too long
     */
    public static String resolveHttpUrl(String feedUrl, String value) {
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
            return result.length() <= MAX_URL_LENGTH ? result : null;
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    /**
     * Reads the first nonblank of the {@code href} and {@code url} attributes.
     *
     * @param reader the XML stream reader positioned at the current element
     * @return the first nonblank attribute value, or {@code null}
     */
    public static String hrefAttr(XMLStreamReader reader) {
        return firstNonBlank(attr(reader, "href"), attr(reader, "url"));
    }

    /**
     * Case-insensitive attribute lookup on the current element.
     *
     * @param reader the XML stream reader containing the attribute
     * @param name   the attribute name to find
     * @return the matching attribute value, or {@code null}
     */
    public static String attr(XMLStreamReader reader, String name) {
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

    /**
     * Parses an RFC 1123 date-time string into an instant.
     *
     * @param raw the date-time string to parse
     * @return the parsed instant, or {@code null} when blank or invalid
     */
    public static Instant parseRfc822(String raw) {
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

    /**
     * Parses a duration expressed as seconds or colon-separated time units.
     *
     * @param raw the duration text to parse
     * @return the positive duration in seconds, or {@code null} for invalid, non-positive, or overflowing values
     */
    public static Integer parseDuration(String raw) {
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
    public static Integer parsePositiveInt(String raw) {
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
    public static Long parsePositiveLong(String raw) {
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

    /**
     * Defaults blank input to {@code "de"} and bounds nonblank values to eight characters.
     *
     * @param language the language value to normalize
     * @return the normalized language value
     */
    public static String normalizeLanguage(String language) {
        if (language == null || language.isBlank()) {
            return "de";
        }
        String trimmed = language.trim();
        return trimmed.length() > 8 ? trimmed.substring(0, 8) : trimmed;
    }

    /**
     * Selects {@code current} when it is nonblank, otherwise {@code candidate}.
     *
     * @param current   the preferred value
     * @param candidate the fallback value
     * @return the first nonblank value
     */
    public static String firstNonBlank(String current, String candidate) {
        if (current != null && !current.isBlank()) {
            return current;
        }
        return candidate;
    }

    /**
     * Trims a value, returning {@code null} when it is absent or blank.
     *
     * @param value the value to normalize
     * @return the trimmed value, or {@code null}
     */
    public static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * Truncates a value to at most {@code maxLength} characters, trailing-trimmed.
     *
     * @param value     the value to truncate
     * @param maxLength the maximum number of characters
     * @return the truncated value
     */
    public static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength).trim();
    }

    /**
     * Bounds a GUID to {@value #MAX_GUID_LENGTH} characters, replacing long values with a digest.
     *
     * @param value the GUID to bound
     * @return the GUID, or a {@code sha256:}-prefixed digest when too long
     */
    public static String boundedGuid(String value) {
        String guid = value.trim();
        if (guid.length() <= MAX_GUID_LENGTH) {
            return guid;
        }
        return "sha256:" + sha256Hex(guid);
    }

    /**
     * Computes the SHA-256 hexadecimal digest of a value in UTF-8.
     *
     * @param value the value to digest
     * @return the hexadecimal digest
     * @throws IllegalStateException if SHA-256 is unavailable
     */
    public static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }
}
