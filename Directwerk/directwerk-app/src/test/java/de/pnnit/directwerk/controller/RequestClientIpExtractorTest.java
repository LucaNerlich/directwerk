package de.pnnit.directwerk.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

class RequestClientIpExtractorTest {

    @Test
    void extractsClientIpFromRequestValues() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("X-Forwarded-For")).thenReturn("unknown, 203.0.113.8");
        when(request.getHeader("X-Real-IP")).thenReturn("198.51.100.4");
        when(request.getRemoteAddr()).thenReturn("192.0.2.2");

        assertThat(RequestClientIpExtractor.extract(request)).isEqualTo("203.0.113.8");
    }
}
