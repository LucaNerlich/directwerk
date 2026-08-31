package de.pnnit.directwerk.modules.core.util;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;

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

    public static boolean hasPubliclyRoutableHost(String hostUrl) {
        if (!isValid(hostUrl)) {
            return false;
        }
        String host = URI.create(hostUrl.trim()).getHost().toLowerCase(Locale.ROOT);
        if (isBlockedHostname(host)) {
            return false;
        }
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            if (addresses.length == 0) {
                return false;
            }
            for (InetAddress address : addresses) {
                if (isBlockedAddress(address)) {
                    return false;
                }
            }
            return true;
        } catch (UnknownHostException | SecurityException ex) {
            return false;
        }
    }

    private static boolean isBlockedHostname(String host) {
        return "localhost".equals(host)
                || host.endsWith(".localhost")
                || host.endsWith(".local")
                || host.endsWith(".internal")
                || host.endsWith(".intranet")
                || host.endsWith(".home.arpa")
                || "metadata.google.internal".equals(host);
    }

    private static boolean isBlockedAddress(InetAddress address) {
        if (address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return true;
        }
        byte[] bytes = address.getAddress();
        if (bytes.length == 16) {
            return (bytes[0] & 0xfe) == 0xfc;
        }
        if (bytes.length == 4) {
            int first = Byte.toUnsignedInt(bytes[0]);
            int second = Byte.toUnsignedInt(bytes[1]);
            int third = Byte.toUnsignedInt(bytes[2]);
            return first == 0
                    || (first == 100 && second >= 64 && second <= 127)
                    || (first == 192 && second == 0 && third == 0)
                    || (first == 192 && second == 0 && third == 2)
                    || (first == 198 && (second == 18 || second == 19))
                    || (first == 198 && second == 51 && third == 100)
                    || (first == 203 && second == 0 && third == 113)
                    || first >= 224;
        }
        return true;
    }

    private static String trimTrailingSlash(String value) {
        String trimmed = value;
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }
}
