package de.pnnit.directwerk.modules.core.util;

/**
 * Extracts the originating client IP for server-side analytics attribution.
 *
 * <p>The first entry of {@code X-Forwarded-For} wins (proxy chain order), then
 * {@code X-Real-IP}, then the connection's remote address. Blank, {@code unknown},
 * and spoof-prone values never propagate — callers treat {@code null} as unattributed.
 */
public final class ClientIpExtractor {

    private ClientIpExtractor() {
    }

    public static String extract(String forwardedFor, String realIp, String remoteAddr) {
        String fromForwardedFor = firstForwardedFor(forwardedFor);
        if (fromForwardedFor != null) {
            return fromForwardedFor;
        }
        if (isUsable(realIp)) {
            return realIp.trim();
        }
        if (isUsable(remoteAddr)) {
            return remoteAddr.trim();
        }
        return null;
    }

    private static String firstForwardedFor(String forwardedFor) {
        if (forwardedFor == null || forwardedFor.isBlank()) {
            return null;
        }
        for (String candidate : forwardedFor.split(",")) {
            String trimmed = candidate.trim();
            if (isUsable(trimmed)) {
                return trimmed;
            }
        }
        return null;
    }

    private static boolean isUsable(String value) {
        return value != null && !value.isBlank() && !"unknown".equalsIgnoreCase(value.trim());
    }
}
