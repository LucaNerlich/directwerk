package de.pnnit.directwerk.security;

import de.pnnit.directwerk.modules.core.util.ClientIpExtractor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import org.springframework.util.StringUtils;

/**
 * Resolves the client IP used as a rate-limit bucket key. Client-supplied forwarding headers are
 * honored only when the immediate peer is a configured trusted proxy; otherwise the socket address
 * is used, so a direct client can never spoof its bucket. Shared by the auth and billing
 * rate-limit filters so both bucket identically behind the same reverse proxy.
 *
 * <p>Contract: this must always yield a non-null bucket key, hence the {@code unknown} fallback.
 * The spoof-resistance rule and the trusted-proxy parsing live in
 * {@link ClientIpExtractor} so they cannot drift from the analytics resolver; only the fallback and
 * the {@code X-Real-IP} policy are local, and they deliberately differ (see
 * {@code controller.RequestClientIpExtractor}).
 */
final class RateLimitClientIpResolver {

    private RateLimitClientIpResolver() {
    }

    static Set<String> trustedProxySet(List<String> trustedProxies) {
        return ClientIpExtractor.trustedProxySet(trustedProxies);
    }

    static String extractClientIp(HttpServletRequest request, Set<String> trustedProxies) {
        String remoteAddr = request.getRemoteAddr();
        if (remoteAddr == null || trustedProxies.isEmpty() || !trustedProxies.contains(remoteAddr)) {
            // Without a trusted immediate peer, never honor client-supplied forwarding headers.
            return remoteAddr != null ? remoteAddr : "unknown";
        }

        // Rate-limit contract: any non-blank hop counts (no "unknown" filtering here), and the
        // bucket key is never null.
        String clientIp = ClientIpExtractor.firstUntrustedHop(
                request.getHeader("X-Forwarded-For"), trustedProxies, StringUtils::hasText);
        return clientIp != null ? clientIp : remoteAddr;
    }
}
