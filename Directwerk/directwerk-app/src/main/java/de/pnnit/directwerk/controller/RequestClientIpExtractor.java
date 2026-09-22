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
 */
public final class RequestClientIpExtractor {

    private RequestClientIpExtractor() {
    }

    /**
     * Extracts the client IP address from an HTTP request at the trusted proxy boundary.
     *
     * @param request the HTTP request
     * @param trustedProxies proxy addresses trusted to append or overwrite forwarding headers
     * @return the extracted client IP address
     */
    public static String extract(HttpServletRequest request, Set<String> trustedProxies) {
        String remoteAddr = ClientIpExtractor.extract(null, null, request.getRemoteAddr());
        if (remoteAddr == null || trustedProxies == null || !trustedProxies.contains(remoteAddr)) {
            return remoteAddr;
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null) {
            String[] hops = forwardedFor.split(",");
            for (int index = hops.length - 1; index >= 0; index--) {
                String hop = ClientIpExtractor.extract(null, null, hops[index]);
                if (hop != null && !trustedProxies.contains(hop)) {
                    return hop;
                }
            }
        }

        return ClientIpExtractor.extract(null, request.getHeader("X-Real-IP"), remoteAddr);
    }
}
