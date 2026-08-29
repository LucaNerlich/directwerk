package de.pnnit.directwerk.modules.content;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PublicSurfacePolicyTest {

    @Test
    void freeContentIsFullyExposed() {
        assertThat(PublicSurfacePolicy.isFreeAccess("FREE")).isTrue();
        assertThat(PublicSurfacePolicy.exposesFullContent("FREE")).isTrue();
        assertThat(PublicSurfacePolicy.includesInPublicRss("FREE")).isTrue();
        assertThat(PublicSurfacePolicy.articleBody("hello", "FREE")).isEqualTo("hello");
    }

    @Test
    void paidContentIsRedactedOnPublicSurfaces() {
        assertThat(PublicSurfacePolicy.isFreeAccess("PAID")).isFalse();
        assertThat(PublicSurfacePolicy.exposesFullContent("PAID")).isFalse();
        assertThat(PublicSurfacePolicy.includesInPublicRss("PAID")).isFalse();
        assertThat(PublicSurfacePolicy.articleBody("secret", "PAID")).isNull();
    }
}
