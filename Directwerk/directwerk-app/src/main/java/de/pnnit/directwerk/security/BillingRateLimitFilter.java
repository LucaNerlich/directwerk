package de.pnnit.directwerk.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rate-limits authenticated billing endpoints per IP and per user id.
 * Runs after bearer-token authentication so distributed checkout abuse against one account is caught.
 */
public class BillingRateLimitFilter extends OncePerRequestFilter {

    private final Cache<String, WindowCounter> counters = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(2))
            .maximumSize(10000)
            .build();

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
            if (isRateLimited(key)) {
                writeRateLimitResponse(response);
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

    private boolean isRateLimited(String key) {
        long windowStart = Instant.now().getEpochSecond() / 60;
        WindowCounter counter = counters.asMap().compute(key, (existingKey, existing) -> {
            if (existing == null || existing.windowStart() != windowStart) {
                return new WindowCounter(windowStart, 1);
            }
            return new WindowCounter(windowStart, existing.count() + 1);
        });
        return counter.count() > limitPerMinute;
    }

    private void writeRateLimitResponse(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(
                "{\"status\":429,\"code\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests\"}"
        );
    }

    private record WindowCounter(long windowStart, int count) {
    }
}
