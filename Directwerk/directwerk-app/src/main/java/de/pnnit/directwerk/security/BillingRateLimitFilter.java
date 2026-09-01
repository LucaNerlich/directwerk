package de.pnnit.directwerk.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rate-limits authenticated billing endpoints per IP and per user id.
 * Runs after bearer-token authentication so distributed checkout abuse against one account is caught.
 */
public class BillingRateLimitFilter extends OncePerRequestFilter {

    private final FixedWindowRateLimiter rateLimiter = new FixedWindowRateLimiter();

    private final int limitPerMinute;

    public BillingRateLimitFilter(int limitPerMinute) {
        if (limitPerMinute <= 0) {
            throw new IllegalArgumentException("Billing rate limit must be positive");
        }
        this.limitPerMinute = limitPerMinute;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (!"POST".equalsIgnoreCase(request.getMethod())
                || !request.getRequestURI().startsWith("/api/v1/me/billing/")) {
            filterChain.doFilter(request, response);
            return;
        }

        for (String key : clientKeys(request)) {
            if (rateLimiter.isRateLimited(key, limitPerMinute)) {
                RateLimitResponses.writeTooManyRequests(response);
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private List<String> clientKeys(HttpServletRequest request) {
        String clientIp = request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
        String ipKey = "billing:ip:" + clientIp;
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof DirectwerkUserPrincipal principal) {
            return List.of(ipKey, "billing:user:" + principal.userId());
        }
        return List.of(ipKey);
    }

}
