package de.pnnit.directwerk.security;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import org.springframework.util.StringUtils;

/**
 * Resolves the client IP for rate limiting. Client-supplied forwarding headers are honored only
 * when the immediate peer is a configured trusted proxy; otherwise the socket address is used, so
 * a direct client can never spoof its bucket. Shared by the auth and billing rate-limit filters
 * so both bucket identically behind the same reverse proxy.
 */
final class ClientIpExtractor {

    private ClientIpExtractor() {
    }

    static Set<String> trustedProxySet(List<String> trustedProxies) {
        return trustedProxies == null
                ? Set.of()
                : Set.copyOf(trustedProxies.stream().filter(StringUtils::hasText).map(String::trim).toList());
    }

    static String extractClientIp(HttpServletRequest request, Set<String> trustedProxies) {
        String remoteAddr = request.getRemoteAddr();
        if (remoteAddr == null || trustedProxies.isEmpty() || !trustedProxies.contains(remoteAddr)) {
            // Without a trusted immediate peer, never honor client-supplied forwarding headers.
            return remoteAddr != null ? remoteAddr : "unknown";
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (!StringUtils.hasText(forwardedFor)) {
            return remoteAddr;
        }

        // Proxies append; walk the chain from the trusted peer outward to find the client.
        String[] hops = forwardedFor.split(",");
        for (int i = hops.length - 1; i >= 0; i--) {
            String ip = hops[i].trim();
            if (StringUtils.hasText(ip) && !trustedProxies.contains(ip)) {
                return ip;
            }
        }
        return remoteAddr;
    }
}
