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

    /**
     * Parses the configured trusted-proxy list into the lookup set every caller gates on.
     * Single source: the auth/billing rate limiters and the analytics resolver previously each
     * carried their own copy of this rule.
     */
    public static java.util.Set<String> trustedProxySet(java.util.List<String> trustedProxies) {
        if (trustedProxies == null) {
            return java.util.Set.of();
        }
        return trustedProxies.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    /**
     * Walks an {@code X-Forwarded-For} chain from the immediate (trusted) peer outward and returns
     * the first hop that {@code usable} accepts and that is not itself a trusted proxy — i.e. the
     * address the request actually originated from. Returns {@code null} when the chain has no
     * such hop.
     *
     * <p>Callers supply {@code usable} because their contracts differ: the rate limiter only
     * requires non-blank, while analytics additionally rejects {@code unknown}. The
     * spoof-resistance rule — never trust a leftmost, client-supplied value — is what lives here
     * once.
     */
    public static String firstUntrustedHop(
            String forwardedFor,
            java.util.Set<String> trustedProxies,
            java.util.function.Predicate<String> usable
    ) {
        if (forwardedFor == null || trustedProxies == null || trustedProxies.isEmpty()) {
            return null;
        }
        String[] hops = forwardedFor.split(",");
        for (int index = hops.length - 1; index >= 0; index--) {
            String hop = hops[index].trim();
            if (usable.test(hop) && !trustedProxies.contains(hop)) {
                return hop;
            }
        }
        return null;
    }

    /** Trims a usable value, or returns {@code null} for blank/{@code unknown} input. */
    public static String normalize(String value) {
        return isUsable(value) ? value.trim() : null;
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

    /** Whether a candidate address may be used (non-blank, not the literal "unknown"). */
    public static boolean isUsable(String value) {
        return value != null && !value.isBlank() && !"unknown".equalsIgnoreCase(value.trim());
    }
}
