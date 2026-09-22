package de.pnnit.directwerk.controller;

import de.pnnit.directwerk.config.DirectwerkConfig;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Resolves the client IP used for server-side analytics attribution (feed fetches, views,
 * downloads).
 *
 * <p>Client-supplied forwarding headers are honored only when the immediate peer is a configured
 * trusted proxy; otherwise a direct client could forge the IP recorded in analytics and forwarded
 * upstream to Umami. Without a trusted peer the socket address is used (or {@code null} when
 * unavailable, which callers treat as unattributed).
 */
@Component
public class AnalyticsClientIpResolver {

    private final Set<String> trustedProxies;

    @Autowired
    public AnalyticsClientIpResolver(DirectwerkConfig directwerkConfig) {
        this(directwerkConfig.security().trustedProxies());
    }

    public AnalyticsClientIpResolver(List<String> trustedProxies) {
        this.trustedProxies = trustedProxies == null
                ? Set.of()
                : trustedProxies.stream()
                        .filter(StringUtils::hasText)
                        .map(String::trim)
                        .collect(Collectors.toUnmodifiableSet());
    }

    /**
     * Resolves the client IP for a request, honoring forwarding headers only from a trusted peer.
     *
     * @param request the HTTP request
     * @return the client IP, or {@code null} when it cannot be attributed
     */
    public String resolve(HttpServletRequest request) {
        return RequestClientIpExtractor.extract(request, trustedProxies);
    }
}
