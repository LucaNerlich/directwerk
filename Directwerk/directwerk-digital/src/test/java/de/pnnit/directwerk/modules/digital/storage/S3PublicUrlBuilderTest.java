package de.pnnit.directwerk.modules.digital.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URL;
import org.junit.jupiter.api.Test;

class S3PublicUrlBuilderTest {

    @Test
    void rejectsInvalidBaseUrls() {
        assertThatThrownBy(() -> new S3PublicUrlBuilder(null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new S3PublicUrlBuilder("cdn.example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("absolute URI");
        assertThatThrownBy(() -> new S3PublicUrlBuilder("http://cdn.example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("HTTPS");
    }

    @Test
    void trimsTrailingSlashesFromBaseUrl() {
        S3PublicUrlBuilder builder = new S3PublicUrlBuilder("https://cdn.example.com///");

        assertThat(builder.publicCdnBaseUrl()).isEqualTo("https://cdn.example.com");
    }

    @Test
    void buildsCdnUrlForNormalizedKey() throws Exception {
        S3PublicUrlBuilder builder = new S3PublicUrlBuilder("https://cdn.example.com");

        URL url = builder.cdnUrl("/tenant/public/cover.jpg");

        assertThat(url.toExternalForm()).isEqualTo("https://cdn.example.com/tenant/public/cover.jpg");
    }

    @Test
    void rejectsNullS3Key() {
        S3PublicUrlBuilder builder = new S3PublicUrlBuilder("https://cdn.example.com");

        assertThatThrownBy(() -> builder.cdnUrl(null)).isInstanceOf(NullPointerException.class);
    }
}
