package de.pnnit.directwerk.modules.digital.importing;

import de.pnnit.directwerk.modules.core.exception.CodedStatusException;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.digital.net.RemoteContentClient;
import de.pnnit.directwerk.modules.digital.net.RemoteUrlValidator;
import de.pnnit.directwerk.modules.digital.service.MediaUploadRules;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.function.BiFunction;
import java.util.function.BiPredicate;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.slf4j.Logger;

/**
 * Shared, correctness-sensitive building blocks for RSS/Atom content imports.
 *
 * <p>Podcast episode imports and newsletter article imports share the same feed
 * fetching, identity/deduplication, slug allocation, filename-hint and cleanup
 * rules. Keeping a single implementation here means a fix to the digest or the
 * slug loop lands in both pipelines at once.</p>
 *
 * <p>Each caller keeps its own exception type: the tiny {@link ImportErrorFactory}
 * lets the shared helpers raise exactly the exception a module exposes, so no
 * shared exception type is introduced.</p>
 */
public final class FeedImportSupport {

    /**
     * Hard cap on a buffered feed body, so a hostile feed cannot exhaust heap.
     */
    public static final int MAX_FEED_BYTES = 5 * 1024 * 1024;

    private static final Pattern NON_SLUG = Pattern.compile("[^a-z0-9]+");
    private static final int MAX_SLUG_ATTEMPTS = 50;

    private FeedImportSupport() {
    }

    /**
     * Creates a module-specific import exception. Callers pass a lambda that
     * constructs their own exception type; this keeps the shared helpers free of
     * any shared exception hierarchy.
     */
    @FunctionalInterface
    public interface ImportErrorFactory {

        /**
         * Creates an import exception with the given status, code, message, and cause.
         *
         * @param status  the HTTP status to report
         * @param code    the structured error code
         * @param message the human-readable message
         * @param cause   the underlying cause, or {@code null} when there is none
         * @return the module-specific exception
         */
        RuntimeException create(int status, String code, String message, Throwable cause);
    }

    /**
     * Downloads and parses a feed after validating its URL and response content.
     *
     * <p>The URL is validated before the response is opened, so an invalid URL
     * surfaces the validator's error rather than being wrapped as a feed error.
     * Non-2xx responses, oversized/empty bodies, transport failures and parse
     * failures are all reported through {@code errors}.</p>
     *
     * @param remoteContentClient the HTTP client used to open the feed
     * @param feedUrl             the feed URL to fetch
     * @param timeout             the request timeout
     * @param maxBytes            the maximum accepted body size in bytes
     * @param errors              the caller's exception factory
     * @param parser              the module parser, invoked with the final URL and body
     * @param <T>                 the parsed feed type
     * @return the parsed feed
     */
    public static <T> T fetchAndParse(
            RemoteContentClient remoteContentClient,
            String feedUrl,
            Duration timeout,
            int maxBytes,
            ImportErrorFactory errors,
            BiFunction<String, InputStream, T> parser
    ) {
        URI uri = RemoteUrlValidator.requirePublicHttpUrl(feedUrl);
        try (RemoteContentClient.RemoteResponse remote = remoteContentClient.get(uri, timeout)) {
            if (remote.statusCode() < 200 || remote.statusCode() >= 300) {
                throw errors.create(
                        400,
                        "RSS_FEED_UNREACHABLE",
                        "RSS feed returned HTTP " + remote.statusCode(),
                        null
                );
            }
            byte[] xml = readBounded(remote.body(), maxBytes, errors);
            return parser.apply(remote.finalUri().toString(), new ByteArrayInputStream(xml));
        } catch (UploadValidationException ex) {
            throw errors.create(400, ex.getCode(), ex.getMessage(), ex);
        } catch (CodedStatusException ex) {
            // Already a module import error (status check, bounded read or parser).
            throw ex;
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw errors.create(400, "RSS_FEED_UNREACHABLE", "RSS feed could not be downloaded", ex);
        }
    }

    /**
     * Reads input content while enforcing a maximum size and rejecting empty input.
     *
     * @param in       the input stream
     * @param maxBytes the maximum number of bytes to read
     * @param errors   the caller's exception factory
     * @return the content read from the stream
     * @throws IOException if reading the stream fails
     */
    public static byte[] readBounded(InputStream in, int maxBytes, ImportErrorFactory errors) throws IOException {
        byte[] buffer = new byte[Math.min(16 * 1024, maxBytes)];
        var out = new ByteArrayOutputStream();
        int read;
        while ((read = in.read(buffer)) >= 0) {
            if (out.size() + read > maxBytes) {
                throw errors.create(400, "RSS_FEED_INVALID", "RSS feed is larger than 5 MB", null);
            }
            out.write(buffer, 0, read);
        }
        if (out.size() == 0) {
            throw errors.create(400, "RSS_FEED_INVALID", "RSS feed was empty", null);
        }
        return out.toByteArray();
    }

    /**
     * Creates a stable identity for an item imported from an RSS feed.
     *
     * @param feedUrl    the RSS feed URL
     * @param guid       the item's feed GUID
     * @param importKind the noun used in the validation message (for example {@code episode})
     * @param errors     the caller's exception factory
     * @return the SHA-256 hexadecimal digest of the canonical feed URL and trimmed GUID
     */
    public static String importIdentity(
            String feedUrl,
            String guid,
            String importKind,
            ImportErrorFactory errors
    ) {
        if (feedUrl == null || feedUrl.isBlank() || guid == null || guid.isBlank()) {
            throw errors.create(
                    400,
                    "RSS_FEED_INVALID",
                    "feedUrl and guid are required for an " + importKind + " import",
                    null
            );
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] value = (canonicalFeedUrl(feedUrl, errors) + "\n" + guid.trim())
                    .getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(digest.digest(value));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    /**
     * Canonicalizes a public HTTP or HTTPS feed URL for import identity generation.
     *
     * @param feedUrl the feed URL to validate and normalize
     * @param errors  the caller's exception factory
     * @return the canonical ASCII representation of the feed URL
     */
    public static String canonicalFeedUrl(String feedUrl, ImportErrorFactory errors) {
        try {
            URI parsed = URI.create(feedUrl.trim());
            String scheme = parsed.getScheme();
            String host = parsed.getHost();
            if (scheme == null || host == null || parsed.getUserInfo() != null) {
                throw new IllegalArgumentException("feedUrl must be an absolute public URL");
            }
            String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
            if (!"http".equals(normalizedScheme) && !"https".equals(normalizedScheme)) {
                throw new IllegalArgumentException("feedUrl must use http or https");
            }
            int port = parsed.getPort();
            if (("http".equals(normalizedScheme) && port == 80)
                    || ("https".equals(normalizedScheme) && port == 443)) {
                port = -1;
            }
            String path = parsed.getRawPath();
            if (path == null || path.isBlank()) {
                path = "/";
            }
            return new URI(
                    normalizedScheme,
                    null,
                    host.toLowerCase(Locale.ROOT),
                    port,
                    path,
                    parsed.getRawQuery(),
                    null
            ).normalize().toASCIIString();
        } catch (IllegalArgumentException | URISyntaxException ex) {
            throw errors.create(400, "RSS_FEED_INVALID", "feedUrl is not valid", ex);
        }
    }

    /**
     * Allocates an unused tenant-scoped slug, trying up to 50 suffixes.
     *
     * @param tenantId        the tenant that owns the content
     * @param requested       the requested slug, or {@code null}/blank to derive one from the title
     * @param title           the title used to derive a slug when no requested slug is provided
     * @param fallbackSlugWord the slug used when a value yields no usable slug
     * @param slugExists      tests whether a candidate slug is already taken for the tenant
     * @param slugExhausted   supplies the module-specific error when no slug is available
     * @return an available slug
     */
    public static String uniqueSlug(
            Long tenantId,
            String requested,
            String title,
            String fallbackSlugWord,
            BiPredicate<Long, String> slugExists,
            Supplier<RuntimeException> slugExhausted
    ) {
        String base;
        if (requested == null || requested.isBlank()) {
            base = suggestSlug(title, fallbackSlugWord);
        } else {
            try {
                base = SlugNormalizer.normalize(requested);
            } catch (IllegalArgumentException invalid) {
                base = suggestSlug(requested, fallbackSlugWord);
            }
        }
        for (int attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
            String candidate = withSuffix(base, attempt, fallbackSlugWord);
            if (!slugExists.test(tenantId, candidate)) {
                return candidate;
            }
        }
        throw slugExhausted.get();
    }

    /**
     * Builds an import filename hint: the URL's last path segment when it carries
     * a file extension, otherwise a descriptive stem derived from the title. Keeps
     * imported assets from ending up with non-descriptive names such as
     * {@code asset-10_download.bin}.
     *
     * @param title            the content title used to derive a slug-based stem
     * @param url              the remote asset URL
     * @param fallbackStem     the stem used when the title yields no usable slug
     * @param extension        the extension used when the URL segment carries none
     * @param fallbackSlugWord the slug used when the title yields no usable slug
     * @return the filename hint for the ingest command
     */
    public static String importFilenameHint(
            String title,
            String url,
            String fallbackStem,
            String extension,
            String fallbackSlugWord
    ) {
        int slash = url.lastIndexOf('/');
        String last = slash >= 0 ? url.substring(slash + 1) : url;
        int query = last.indexOf('?');
        if (query >= 0) {
            last = last.substring(0, query);
        }
        int dot = last.lastIndexOf('.');
        boolean hasExtension = dot > 0 && dot < last.length() - 1;
        // The title is the readable identifier in media libraries, so it always
        // wins; the URL only contributes its real extension, if any.
        String slug = suggestSlug(title, fallbackSlugWord);
        if (!fallbackSlugWord.equals(slug)) {
            return slug + (hasExtension ? last.substring(dot) : "." + extension);
        }
        if (hasExtension && !MediaUploadRules.isGenericFilenameStem(last.substring(0, dot))) {
            return last;
        }
        return fallbackStem + (hasExtension ? last.substring(dot) : "." + extension);
    }

    /**
     * Discards ingested assets in reverse order, continuing cleanup when an asset
     * cannot be discarded.
     *
     * @param cleanupClaims ownership proofs for assets to discard
     * @param discard  performs the discard for one asset
     * @param log      the caller's logger, so warnings keep their original category
     * @param subject  the noun used in the warning (for example {@code unreferenced RSS import asset})
     */
    public static <T> void discardIngestedAssets(
            List<T> cleanupClaims,
            Consumer<T> discard,
            Logger log,
            String subject
    ) {
        for (int i = cleanupClaims.size() - 1; i >= 0; i--) {
            T cleanupClaim = cleanupClaims.get(i);
            try {
                discard.accept(cleanupClaim);
            } catch (RuntimeException cleanupFailure) {
                // Cleanup claims contain bearer-style tokens and must never be logged.
                log.warn("Failed to discard {}", subject, cleanupFailure);
            }
        }
    }

    /**
     * Creates a URL-friendly slug from a title.
     *
     * @param title        the title from which to create the slug
     * @param fallbackWord the slug returned when the title is blank or cannot produce a valid slug
     * @return the normalized slug, or {@code fallbackWord}
     */
    public static String suggestSlug(String title, String fallbackWord) {
        if (title == null || title.isBlank()) {
            return fallbackWord;
        }
        String folded = foldGerman(title.trim());
        String slug = NON_SLUG.matcher(folded.toLowerCase(Locale.ROOT)).replaceAll("-");
        slug = slug.replaceAll("^-+|-+$", "");
        if (slug.length() > 63) {
            slug = slug.substring(0, 63).replaceAll("-+$", "");
        }
        if (slug.isEmpty() || !Character.isLetterOrDigit(slug.charAt(0))) {
            slug = fallbackWord;
        }
        if (slug.length() == 1) {
            return slug;
        }
        if (!Character.isLetterOrDigit(slug.charAt(slug.length() - 1))) {
            slug = slug.substring(0, slug.length() - 1);
        }
        return slug.isEmpty() ? fallbackWord : slug;
    }

    /**
     * Appends an attempt suffix to a slug while keeping the combined value within 64 characters.
     *
     * @param base         the slug to suffix
     * @param attempt      the attempt number used to form the suffix
     * @param fallbackWord the slug used when the trimmed base becomes empty
     * @return the unchanged base when the attempt is 1 or lower; otherwise, the suffixed slug
     */
    public static String withSuffix(String base, int attempt, String fallbackWord) {
        if (attempt <= 1) {
            return base;
        }
        String suffix = "-" + attempt;
        int maxBase = Math.max(1, 64 - suffix.length());
        String trimmed = base.length() > maxBase ? base.substring(0, maxBase).replaceAll("-+$", "") : base;
        if (trimmed.isEmpty()) {
            trimmed = fallbackWord;
        }
        return trimmed + suffix;
    }

    /**
     * Replaces German umlauts and sharp s with their ASCII equivalents.
     *
     * @param title the text to convert
     * @return the text with German characters converted to ASCII
     */
    private static String foldGerman(String title) {
        return title
                .replace("ä", "ae")
                .replace("ö", "oe")
                .replace("ü", "ue")
                .replace("Ä", "Ae")
                .replace("Ö", "Oe")
                .replace("Ü", "Ue")
                .replace("ß", "ss");
    }
}
