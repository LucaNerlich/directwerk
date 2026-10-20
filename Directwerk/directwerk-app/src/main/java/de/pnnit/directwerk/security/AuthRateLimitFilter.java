package de.pnnit.directwerk.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import de.pnnit.directwerk.modules.core.util.TokenHashUtil;

public class AuthRateLimitFilter extends OncePerRequestFilter {

    private final FixedWindowRateLimiter rateLimiter = new FixedWindowRateLimiter();

    private final int oauthTokenLimitPerMinute;
    private final int forgotPasswordLimitPerMinute;
    private final int authLimitPerMinute;
    private final int contactLimitPerMinute;
    private final Set<String> trustedProxies;
    private static final int MAX_USERNAME_KEY_LENGTH = 255;

    public AuthRateLimitFilter(
            int oauthTokenLimitPerMinute,
            int forgotPasswordLimitPerMinute,
            int authLimitPerMinute,
            int contactLimitPerMinute,
            List<String> trustedProxies
    ) {
        this.oauthTokenLimitPerMinute = oauthTokenLimitPerMinute;
        this.forgotPasswordLimitPerMinute = forgotPasswordLimitPerMinute;
        this.authLimitPerMinute = authLimitPerMinute;
        this.contactLimitPerMinute = contactLimitPerMinute;
        this.trustedProxies = RateLimitClientIpResolver.trustedProxySet(trustedProxies);
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
                if (rateLimiter.isRateLimited(key, rule.limit())) {
                    RateLimitResponses.writeTooManyRequests(response);
                    return;
                }
            }
        }
        filterChain.doFilter(request, response);
    }

    private RateLimitRule resolveRule(HttpServletRequest request) {
        String path = request.getRequestURI();
        if ("GET".equalsIgnoreCase(request.getMethod()) && "/api/v1/public/altcha/challenge".equals(path)) {
            return new RateLimitRule("contact-challenge", contactLimitPerMinute * 3);
        }
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return null;
        }
        if ("/oauth2/token".equals(path)) {
            return new RateLimitRule("oauth", oauthTokenLimitPerMinute);
        }
        if ("/api/v1/auth/forgot-password".equals(path)) {
            return new RateLimitRule("forgot", forgotPasswordLimitPerMinute);
        }
        if (path.startsWith("/api/v1/auth/")) {
            return new RateLimitRule("auth", authLimitPerMinute);
        }
        if ("/api/v1/public/contact".equals(path)) {
            return new RateLimitRule("contact", contactLimitPerMinute);
        }
        if (path.startsWith("/api/v1/public/newsletter-lists/") && path.endsWith("/subscribe")) {
            // Unauthenticated, no PoW — reuses the contact-form limit rather than adding a
            // new config knob for what is the same class of public-form abuse surface.
            return new RateLimitRule("newsletter-subscribe", contactLimitPerMinute);
        }
        return null;
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
            usernameKey = keyPrefix + TokenHashUtil.sha256Hex(normalized);
        } else {
            usernameKey = keyPrefix + normalized;
        }
        return List.of(ipKey, usernameKey);
    }

    private String extractClientIp(HttpServletRequest request) {
        return RateLimitClientIpResolver.extractClientIp(request, trustedProxies);
    }

    private record RateLimitRule(String group, int limit) {
    }
}
