package de.pnnit.directwerk.modules.core.util;

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
}
