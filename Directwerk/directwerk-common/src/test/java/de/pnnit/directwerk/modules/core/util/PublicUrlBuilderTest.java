package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PublicUrlBuilderTest {

    @Test
    void omitsDefaultHttpPort() {
        assertThat(PublicUrlBuilder.baseUrl("http", "example.com", 80))
                .isEqualTo("http://example.com");
    }

    @Test
    void omitsDefaultHttpsPort() {
        assertThat(PublicUrlBuilder.baseUrl("https", "example.com", 443))
                .isEqualTo("https://example.com");
    }

    @Test
    void keepsNonDefaultPort() {
        assertThat(PublicUrlBuilder.baseUrl("http", "localhost", 8080))
                .isEqualTo("http://localhost:8080");
    }

    @Test
    void keepsNonDefaultHttpsPort() {
        assertThat(PublicUrlBuilder.baseUrl("https", "example.com", 8443))
                .isEqualTo("https://example.com:8443");
    }
}
