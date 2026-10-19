package de.pnnit.directwerk.modules.core.util;

/**
 * Shared helpers for the originating client IP (issue #312): the trusted-proxy walk lives in
 * {@link #firstUntrustedHop}, so callers never trust the left-most forwarded value.
 *
 * <p>Blank and {@code unknown} values never propagate — callers treat {@code null} as
 * unattributed.</p>
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

    /** Whether a candidate address may be used (non-blank, not the literal "unknown"). */
    public static boolean isUsable(String value) {
        return value != null && !value.isBlank() && !"unknown".equalsIgnoreCase(value.trim());
    }
}
