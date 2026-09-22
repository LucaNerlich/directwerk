package de.pnnit.directwerk.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.junit.jupiter.api.Test;

class AnalyticsClientIpResolverTest {

    @Test
    void ignoresForwardingHeadersFromUntrustedPeer() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("198.51.100.4");
        lenient().when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.7");
        lenient().when(request.getHeader("X-Real-IP")).thenReturn("203.0.113.8");

        assertThat(new AnalyticsClientIpResolver(List.of("10.0.0.1")).resolve(request))
                .isEqualTo("198.51.100.4");
    }

    @Test
    void usesForwardingHeadersWhenPeerIsTrustedProxy() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("10.0.0.1");
        lenient().when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.7");
        lenient().when(request.getHeader("X-Real-IP")).thenReturn("203.0.113.8");

        assertThat(new AnalyticsClientIpResolver(List.of(" 10.0.0.1 ")).resolve(request))
                .isEqualTo("203.0.113.7");
    }

    @Test
    void usesAddressAfterTrustedProxyBoundaryInsteadOfSpoofedLeftmostValue() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("10.0.0.1");
        when(request.getHeader("X-Forwarded-For"))
                .thenReturn("198.51.100.99, 203.0.113.7, 10.0.0.2");

        assertThat(new AnalyticsClientIpResolver(List.of("10.0.0.1", "10.0.0.2")).resolve(request))
                .isEqualTo("203.0.113.7");
    }

    @Test
    void returnsNullWhenPeerIsUnknownAndNoRemoteAddress() {
        HttpServletRequest request = mock(HttpServletRequest.class);

        assertThat(new AnalyticsClientIpResolver(List.of("10.0.0.1")).resolve(request)).isNull();
    }
}
