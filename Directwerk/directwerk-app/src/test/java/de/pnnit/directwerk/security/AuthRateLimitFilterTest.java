package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

class AuthRateLimitFilterTest {

    @Test
    void usesForwardedClientIpOnlyWhenPeerIsTrustedProxy() throws Exception {
        AuthRateLimitFilter filter = new AuthRateLimitFilter(100, 100, 1, 100, List.of("10.0.0.1"));
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("POST");
        when(request.getRequestURI()).thenReturn("/api/v1/auth/register");
        when(request.getRemoteAddr()).thenReturn("10.0.0.1");
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.9, 10.0.0.1");
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(request, first, chain);
        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(request, second, chain);

        assertThat(first.getStatus()).isEqualTo(200);
        assertThat(second.getStatus()).isEqualTo(429);
    }

    @Test
    void ignoresForwardedHeaderFromUntrustedPeer() throws Exception {
        AuthRateLimitFilter filter = new AuthRateLimitFilter(100, 100, 1, 100, List.of("10.0.0.1"));
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("POST");
        when(request.getRequestURI()).thenReturn("/api/v1/auth/register");
        when(request.getRemoteAddr()).thenReturn("198.51.100.20");
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.9");
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(request, first, chain);
        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(request, second, chain);

        assertThat(second.getStatus()).isEqualTo(429);
    }

    @Test
    void blocksLoginAttemptsAgainstSameUsernameAcrossDifferentIps() throws Exception {
        AuthRateLimitFilter filter = new AuthRateLimitFilter(2, 100, 100, 100, List.of());
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(loginRequest("203.0.113.1", "victim@example.com"), first, chain);

        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(loginRequest("203.0.113.2", "victim@example.com"), second, chain);

        MockHttpServletResponse third = new MockHttpServletResponse();
        filter.doFilter(loginRequest("203.0.113.3", "victim@example.com"), third, chain);

        assertThat(first.getStatus()).isEqualTo(200);
        assertThat(second.getStatus()).isEqualTo(200);
        assertThat(third.getStatus()).isEqualTo(429);
    }

    private HttpServletRequest loginRequest(String remoteAddr, String username) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("POST");
        when(request.getRequestURI()).thenReturn("/oauth2/token");
        when(request.getRemoteAddr()).thenReturn(remoteAddr);
        when(request.getParameter("username")).thenReturn(username);
        return request;
    }

    @Test
    void ignoresLeftMostForwardedAddressWhenChainIncludesTrustedProxies() throws Exception {
        AuthRateLimitFilter filter = new AuthRateLimitFilter(100, 100, 1, 100, List.of("10.0.0.1", "10.0.0.2"));
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("POST");
        when(request.getRequestURI()).thenReturn("/api/v1/auth/register");
        when(request.getRemoteAddr()).thenReturn("10.0.0.1");
        when(request.getHeader("X-Forwarded-For")).thenReturn("198.51.100.99, 203.0.113.9, 10.0.0.1");
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(request, first, chain);

        when(request.getRemoteAddr()).thenReturn("10.0.0.2");
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.9, 10.0.0.2");
        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(request, second, chain);

        assertThat(first.getStatus()).isEqualTo(200);
        assertThat(second.getStatus()).isEqualTo(429);
    }

    @Test
    void rateLimitsPublicContactSubmissions() throws Exception {
        AuthRateLimitFilter filter = new AuthRateLimitFilter(100, 100, 100, 1, List.of());
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(publicContactRequest("203.0.113.1"), first, chain);

        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(publicContactRequest("203.0.113.1"), second, chain);

        assertThat(first.getStatus()).isEqualTo(200);
        assertThat(second.getStatus()).isEqualTo(429);
    }

    @Test
    void rateLimitsPublicAltchaChallengeRequests() throws Exception {
        AuthRateLimitFilter filter = new AuthRateLimitFilter(100, 100, 100, 1, List.of());
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse first = new MockHttpServletResponse();
        filter.doFilter(altchaChallengeRequest("203.0.113.2"), first, chain);
        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(altchaChallengeRequest("203.0.113.2"), second, chain);
        MockHttpServletResponse third = new MockHttpServletResponse();
        filter.doFilter(altchaChallengeRequest("203.0.113.2"), third, chain);
        MockHttpServletResponse fourth = new MockHttpServletResponse();
        filter.doFilter(altchaChallengeRequest("203.0.113.2"), fourth, chain);

        assertThat(first.getStatus()).isEqualTo(200);
        assertThat(second.getStatus()).isEqualTo(200);
        assertThat(third.getStatus()).isEqualTo(200);
        assertThat(fourth.getStatus()).isEqualTo(429);
    }

    private HttpServletRequest publicContactRequest(String remoteAddr) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("POST");
        when(request.getRequestURI()).thenReturn("/api/v1/public/contact");
        when(request.getRemoteAddr()).thenReturn(remoteAddr);
        return request;
    }

    private HttpServletRequest altchaChallengeRequest(String remoteAddr) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("GET");
        when(request.getRequestURI()).thenReturn("/api/v1/public/altcha/challenge");
        when(request.getRemoteAddr()).thenReturn(remoteAddr);
        return request;
    }
}
