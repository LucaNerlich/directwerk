package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class RequestPathsTest {

    @Test
    void decodesPercentEncodedPathsLikeTheDispatcher() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/%6dedia/1");

        assertThat(RequestPaths.of(request)).isEqualTo("/api/v1/media/1");
    }

    @Test
    void stripsTheContextPath() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/tenant/formats");
        request.setContextPath("/api");

        assertThat(RequestPaths.of(request)).isEqualTo("/v1/tenant/formats");
    }
}
