package de.pnnit.directwerk.modules.core.util;

import java.util.Locale;

public final class PublicUrlBuilder {

    private PublicUrlBuilder() {
    }

    /**
     * Builds an origin URL, omitting the port when it is the default for the scheme.
     *
     * @return the origin URL in the form {@code scheme://host[:port]}
     */
    public static String baseUrl(String scheme, String host, int port) {
        boolean isDefaultPort = ("http".equalsIgnoreCase(scheme) && port == 80)
                || ("https".equalsIgnoreCase(scheme) && port == 443);
        return scheme + "://" + host + (isDefaultPort ? "" : ":" + port);
    }

    /**
     * Origin for a verified public host: {@code http} on loopback, {@code https} elsewhere.
     * Shared by email auth links and content deep links so local Mailpit / Mailgun tests stay
     * clickable.
     */
    public static String publicOrigin(String host) {
        if (isLoopbackHost(host)) {
            return "http://" + host;
        }
        return "https://" + host;
    }

    public static boolean isLoopbackHost(String host) {
        if (host == null || host.isBlank()) {
            return false;
        }
        String normalized = host.toLowerCase(Locale.ROOT);
        String hostname = stripPort(normalized);
        return "localhost".equals(hostname)
                || hostname.endsWith(".localhost")
                || "127.0.0.1".equals(hostname)
                || "[::1]".equals(hostname);
    }

    private static String stripPort(String host) {
        if (host.startsWith("[")) {
            int end = host.indexOf(']');
            return end >= 0 ? host.substring(0, end + 1) : host;
        }
        int colon = host.lastIndexOf(':');
        if (colon > 0 && host.indexOf(':') == colon) {
            return host.substring(0, colon);
        }
        return host;
    }
}
