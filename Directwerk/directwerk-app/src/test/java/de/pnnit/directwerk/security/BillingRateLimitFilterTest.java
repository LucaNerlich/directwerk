package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class BillingRateLimitFilterTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void blocksCheckoutAttemptsAgainstSameUserAcrossDifferentIps() throws Exception {
        BillingRateLimitFilter filter = new BillingRateLimitFilter(2, List.of());
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(billingRequest("203.0.113.1", 42L), first, chain);

        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(billingRequest("203.0.113.2", 42L), second, chain);

        MockHttpServletResponse third = new MockHttpServletResponse();
        filter.doFilter(billingRequest("203.0.113.3", 42L), third, chain);

        assertThat(first.getStatus()).isEqualTo(200);
        assertThat(second.getStatus()).isEqualTo(200);
        assertThat(third.getStatus()).isEqualTo(429);
    }

    @Test
    void ignoresNonBillingRoutes() throws Exception {
        BillingRateLimitFilter filter = new BillingRateLimitFilter(1, List.of());
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("GET");
        when(request.getRequestURI()).thenReturn("/api/v1/me/subscriptions");
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void rateLimitResponseUsesErrorEnvelope() throws Exception {
        BillingRateLimitFilter filter = new BillingRateLimitFilter(1, List.of());
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(billingRequest("203.0.113.1", 7L), first, chain);

        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(billingRequest("203.0.113.1", 7L), second, chain);

        assertThat(second.getStatus()).isEqualTo(429);
        assertThat(second.getHeader("Retry-After")).isEqualTo("60");
        assertThat(second.getContentAsString()).contains("\"statusCode\":429");
        assertThat(second.getContentAsString()).contains("\"code\":\"RATE_LIMIT_EXCEEDED\"");
    }

    @Test
    void usesForwardedClientIpOnlyWhenPeerIsTrustedProxy() throws Exception {
        BillingRateLimitFilter filter = new BillingRateLimitFilter(1, List.of("10.0.0.1"));
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(proxiedBillingRequest("10.0.0.1", "203.0.113.9", 7L), first, chain);

        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(proxiedBillingRequest("10.0.0.1", "198.51.100.23", 8L), second, chain);

        assertThat(first.getStatus()).isEqualTo(200);
        assertThat(second.getStatus()).isEqualTo(200);
    }

    @Test
    void ignoresForwardedHeaderFromUntrustedPeer() throws Exception {
        BillingRateLimitFilter filter = new BillingRateLimitFilter(1, List.of("10.0.0.1"));
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(proxiedBillingRequest("198.51.100.20", "203.0.113.9", 7L), first, chain);

        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(proxiedBillingRequest("198.51.100.20", "203.0.113.10", 8L), second, chain);

        assertThat(first.getStatus()).isEqualTo(200);
        assertThat(second.getStatus()).isEqualTo(429);
    }

    private HttpServletRequest proxiedBillingRequest(String remoteAddr, String forwardedFor, Long userId) {
        HttpServletRequest request = billingRequest(remoteAddr, userId);
        when(request.getHeader("X-Forwarded-For")).thenReturn(forwardedFor);
        return request;
    }

    private HttpServletRequest billingRequest(String remoteAddr, Long userId) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new DirectwerkUserPrincipal(
                        userId,
                        "member@example.com",
                        "hash",
                        5L,
                        List.of()
                ),
                null,
                List.of()
        ));
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("POST");
        when(request.getRequestURI()).thenReturn("/api/v1/me/billing/checkout-sessions");
        when(request.getRemoteAddr()).thenReturn(remoteAddr);
        return request;
    }
}
