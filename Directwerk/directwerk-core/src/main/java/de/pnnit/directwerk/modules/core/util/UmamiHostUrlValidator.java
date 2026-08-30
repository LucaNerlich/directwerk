package de.pnnit.directwerk.modules.core.util;

import java.net.URI;

public final class UmamiHostUrlValidator {

    private UmamiHostUrlValidator() {
    }

    public static boolean isValid(String hostUrl) {
        if (hostUrl == null || hostUrl.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(hostUrl.trim());
            return uri.isAbsolute()
                    && "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getHost() != null
                    && !uri.getHost().isBlank()
                    && uri.getUserInfo() == null
                    && uri.getRawQuery() == null
                    && uri.getRawFragment() == null
                    && (uri.getPath() == null || uri.getPath().isEmpty() || "/".equals(uri.getPath()));
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    public static String normalize(String hostUrl) {
        if (hostUrl == null) {
            return null;
        }
        String trimmed = hostUrl.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimTrailingSlash(trimmed);
    }

    private static String trimTrailingSlash(String value) {
        String trimmed = value;
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }
}
