package de.pnnit.directwerk.controller;

import de.pnnit.directwerk.modules.core.util.ClientIpExtractor;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;

/**
 * Extracts analytics client IP values from an HTTP request.
 *
 * <p>Forwarding headers are honored only across configured trusted proxies. The forwarded chain is
 * traversed from the immediate peer outward, stopping at the first untrusted address so a
 * client-supplied leftmost value cannot spoof analytics attribution.
 *
 * <p>Contract: {@code null} is meaningful here — it means "unattributed". That, and honoring
 * {@code X-Real-IP}, is what distinguishes this from the rate-limiter variant; the
 * spoof-resistance rule itself is shared via {@link ClientIpExtractor}.
 */
public final class RequestClientIpExtractor {

    private RequestClientIpExtractor() {
    }

    /**
     * Extracts the client IP address from an HTTP request at the trusted proxy boundary.
     *
     * @param request the HTTP request
     * @param trustedProxies proxy addresses trusted to append or overwrite forwarding headers
     * @return the extracted client IP address, or {@code null} when it cannot be attributed
     */
    public static String extract(HttpServletRequest request, Set<String> trustedProxies) {
        String remoteAddr = ClientIpExtractor.normalize(request.getRemoteAddr());
        if (remoteAddr == null || trustedProxies == null || !trustedProxies.contains(remoteAddr)) {
            return remoteAddr;
        }

        String hop = ClientIpExtractor.firstUntrustedHop(
                request.getHeader("X-Forwarded-For"), trustedProxies, ClientIpExtractor::isUsable);
        if (hop != null) {
            return hop;
        }

        return ClientIpExtractor.normalize(request.getHeader("X-Real-IP"));
    }
}
