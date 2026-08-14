package de.pnnit.directwerk.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

public class AuthRateLimitFilter extends OncePerRequestFilter {

    private final Cache<String, WindowCounter> counters = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(2))
            .maximumSize(10000)
            .build();

    private final int oauthTokenLimitPerMinute;
    private final int forgotPasswordLimitPerMinute;
    private final int authLimitPerMinute;
    private final Set<String> trustedProxies;
    private static final int MAX_USERNAME_KEY_LENGTH = 255;

    public AuthRateLimitFilter(
            int oauthTokenLimitPerMinute,
            int forgotPasswordLimitPerMinute,
            int authLimitPerMinute,
            List<String> trustedProxies
    ) {
        this.oauthTokenLimitPerMinute = oauthTokenLimitPerMinute;
        this.forgotPasswordLimitPerMinute = forgotPasswordLimitPerMinute;
        this.authLimitPerMinute = authLimitPerMinute;
        this.trustedProxies = trustedProxies == null
                ? Set.of()
                : Set.copyOf(trustedProxies.stream().filter(StringUtils::hasText).map(String::trim).toList());
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        RateLimitRule rule = resolveRule(request);
        if (rule != null) {
            for (String key : clientKeys(request, rule)) {
                if (isRateLimited(key, rule.limit())) {
                    writeRateLimitResponse(response);
                    return;
                }
            }
        }
        filterChain.doFilter(request, response);
    }

    private RateLimitRule resolveRule(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return null;
        }
        String path = request.getRequestURI();
        if ("/oauth2/token".equals(path)) {
            return new RateLimitRule("oauth", oauthTokenLimitPerMinute);
        }
        if ("/api/v1/auth/forgot-password".equals(path)) {
            return new RateLimitRule("forgot", forgotPasswordLimitPerMinute);
        }
        if (path.startsWith("/api/v1/auth/")) {
            return new RateLimitRule("auth", authLimitPerMinute);
        }
        if (path.startsWith("/api/v1/me/billing/")) {
            return new RateLimitRule("billing", 10);
        }
        return null;
    }

    private boolean isRateLimited(String key, int limitPerMinute) {
        long windowStart = Instant.now().getEpochSecond() / 60;
        WindowCounter counter = counters.asMap().compute(key, (existingKey, existing) -> {
            if (existing == null || existing.windowStart() != windowStart) {
                return new WindowCounter(windowStart, 1);
            }
            return new WindowCounter(windowStart, existing.count() + 1);
        });
        return counter.count() > limitPerMinute;
    }

    /**
     * Keys to rate-limit this request against. Always includes a per-IP key; the OAuth2 token
     * endpoint additionally gets a per-username key so a distributed attack spread across many
     * source IPs against one account is still caught.
     */
    private List<String> clientKeys(HttpServletRequest request, RateLimitRule rule) {
        String clientIp = extractClientIp(request);
        String ipKey = rule.group() + ":ip:" + clientIp;
        if (!"oauth".equals(rule.group())) {
            return List.of(ipKey);
        }
        String username = request.getParameter("username");
        if (!StringUtils.hasText(username)) {
            return List.of(ipKey);
        }
        String normalized = username.trim().toLowerCase(java.util.Locale.ROOT);
        String keyPrefix = rule.group() + ":user:";
        String usernameKey;
        if (keyPrefix.length() + normalized.length() > MAX_USERNAME_KEY_LENGTH) {
            // Username too long for direct keying; use a fixed-size SHA-256 digest instead
            usernameKey = keyPrefix + sha256Hex(normalized);
        } else {
            usernameKey = keyPrefix + normalized;
        }
        return List.of(ipKey, usernameKey);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    private String extractClientIp(HttpServletRequest request) {
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

    private void writeRateLimitResponse(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(
                "{\"status\":429,\"code\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests\"}"
        );
    }

    private record RateLimitRule(String group, int limit) {
    }

    private record WindowCounter(long windowStart, int count) {
    }
}
