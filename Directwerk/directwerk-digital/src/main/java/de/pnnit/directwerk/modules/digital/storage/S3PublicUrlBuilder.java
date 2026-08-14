package de.pnnit.directwerk.modules.digital.storage;

import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.util.Objects;

/**
 * Builds stable public CDN URLs for {@code public/} object keys.
 */
public class S3PublicUrlBuilder {

    private final String publicCdnBaseUrl;

    public S3PublicUrlBuilder(String publicCdnBaseUrl) {
        Objects.requireNonNull(publicCdnBaseUrl, "publicCdnBaseUrl");
        String trimmed = trimTrailingSlash(publicCdnBaseUrl);
        URI uri;
        try {
            uri = URI.create(trimmed);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("publicCdnBaseUrl must be a valid URI", ex);
        }
        if (!uri.isAbsolute()) {
            throw new IllegalArgumentException("publicCdnBaseUrl must be an absolute URI");
        }
        if (uri.getHost() == null) {
            throw new IllegalArgumentException("publicCdnBaseUrl must have a valid host");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalArgumentException("publicCdnBaseUrl must use HTTPS scheme");
        }
        this.publicCdnBaseUrl = trimmed;
    }

    /**
     * Returns the configured public CDN origin (no trailing slash).
     */
    public String publicCdnBaseUrl() {
        return publicCdnBaseUrl;
    }

    /**
     * Returns the CDN URL for a public object key.
     *
     * @param s3Key tenant-prefixed object key
     * @return absolute CDN URL
     */
    public URL cdnUrl(String s3Key) {
        Objects.requireNonNull(s3Key, "s3Key");
        String key = s3Key.startsWith("/") ? s3Key.substring(1) : s3Key;
        try {
            return URI.create(publicCdnBaseUrl + "/" + key).toURL();
        } catch (MalformedURLException | IllegalArgumentException ex) {
            throw new IllegalStateException("Invalid public CDN URL for key", ex);
        }
    }

    private static String trimTrailingSlash(String value) {
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }
}
