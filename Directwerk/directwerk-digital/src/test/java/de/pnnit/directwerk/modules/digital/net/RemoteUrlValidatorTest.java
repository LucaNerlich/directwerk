package de.pnnit.directwerk.modules.digital.net;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import java.net.URI;
import org.junit.jupiter.api.Test;

class RemoteUrlValidatorTest {

    @Test
    void acceptsPublicHttpsUrl() {
        URI uri = RemoteUrlValidator.requirePublicHttpUrl("https://1.1.1.1/podcast.xml");
        assertThat(uri.getHost()).isEqualTo("1.1.1.1");
    }

    @Test
    void rejectsPrivateIpv4() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("http://127.0.0.1/secret"))
                .isInstanceOf(UploadValidationException.class)
                .extracting("code")
                .isEqualTo("REMOTE_URL_FORBIDDEN");
    }

    @Test
    void rejectsSiteLocalIpv4() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("http://10.0.0.1/feed.xml"))
                .isInstanceOf(UploadValidationException.class)
                .extracting("code")
                .isEqualTo("REMOTE_URL_FORBIDDEN");
    }

    @Test
    void rejectsCarrierGradeNatIpv4() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("http://100.64.0.1/feed.xml"))
                .isInstanceOf(UploadValidationException.class)
                .extracting("code")
                .isEqualTo("REMOTE_URL_FORBIDDEN");
    }

    @Test
    void rejectsUniqueLocalIpv6() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("http://[fd00::1]/feed.xml"))
                .isInstanceOf(UploadValidationException.class)
                .extracting("code")
                .isEqualTo("REMOTE_URL_FORBIDDEN");
    }

    @Test
    void rejectsLocalhostHostname() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("http://localhost/feed.xml"))
                .isInstanceOf(UploadValidationException.class);
    }

    @Test
    void rejectsUserInfo() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("https://user:pass@example.com/a"))
                .isInstanceOf(UploadValidationException.class);
    }

    @Test
    void rejectsFileScheme() {
        assertThatThrownBy(() -> RemoteUrlValidator.requirePublicHttpUrl("file:///etc/passwd"))
                .isInstanceOf(UploadValidationException.class);
    }
}
