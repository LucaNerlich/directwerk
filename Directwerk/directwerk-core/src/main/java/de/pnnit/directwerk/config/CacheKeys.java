package de.pnnit.directwerk.config;

import java.util.Locale;

/**
 * Cache-key builders shared by the caching and eviction sides.
 *
 * <p>Every host-keyed cache derives its key here, so a resolve and an eviction that receive
 * the same host in different casing or with surrounding whitespace hit the same entry. SpEL
 * users reference the same helper — the key is never written a second time.</p>
 */
public final class CacheKeys {

    private CacheKeys() {
    }

    /**
     * Normalizes a host for the {@code tenant-by-host} cache.
     *
     * @param host the routing host
     * @return the trimmed, lower-cased host
     */
    public static String host(String host) {
        return host == null ? "" : host.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Builds the key for the {@code public-site-config} cache.
     *
     * @param scheme the request scheme
     * @param host   the request host
     * @param port   the request port
     * @return the normalized {@code host:scheme:port} key
     */
    public static String siteConfig(String scheme, String host, int port) {
        return host(host) + ':' + scheme + ':' + port;
    }
}
