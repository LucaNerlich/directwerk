package de.pnnit.directwerk.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.junit.jupiter.api.Test;

class RequestClientIpExtractorTest {

    @Test
    void extractsClientIpFromRequestValues() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("X-Forwarded-For"))
                .thenReturn("198.51.100.99, 203.0.113.8, 192.0.2.3");
        when(request.getHeader("X-Real-IP")).thenReturn("198.51.100.4");
        when(request.getRemoteAddr()).thenReturn("192.0.2.2");

        assertThat(RequestClientIpExtractor.extract(request, Set.of("192.0.2.2", "192.0.2.3")))
                .isEqualTo("203.0.113.8");
    }
}
