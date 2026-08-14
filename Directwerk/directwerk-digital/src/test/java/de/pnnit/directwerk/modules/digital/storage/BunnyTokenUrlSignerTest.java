package de.pnnit.directwerk.modules.digital.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class BunnyTokenUrlSignerTest {

    @Test
    void signObjectGetUsesAdvancedHs256QueryToken() throws Exception {
        var url = BunnyTokenUrlSigner.signObjectGet(
                "https://cdn-private.example.test",
                "alpha/private/audio/ep.mp3",
                "test-security-key",
                Duration.ofHours(1)
        );

        assertThat(url.getProtocol()).isEqualTo("https");
        assertThat(url.getHost()).isEqualTo("cdn-private.example.test");
        assertThat(url.getPath()).isEqualTo("/alpha/private/audio/ep.mp3");

        String query = url.getQuery();
        assertThat(query).contains("token=HS256-");
        assertThat(query).contains("expires=");

        String token = queryParam(query, "token");
        String expires = queryParam(query, "expires");
        String expected = expectedHs256Token(
                "/alpha/private/audio/ep.mp3",
                expires,
                "test-security-key"
        );
        assertThat(token).isEqualTo(expected);
    }

    @Test
    void signObjectGetRejectsBlankKey() {
        assertThatThrownBy(() -> BunnyTokenUrlSigner.signObjectGet(
                "https://cdn-private.example.test",
                "alpha/private/audio/ep.mp3",
                " ",
                Duration.ofHours(1)
        )).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void signObjectGetRequiresHttpsBase() {
        assertThatThrownBy(() -> BunnyTokenUrlSigner.signObjectGet(
                "http://cdn-private.example.test",
                "alpha/private/audio/ep.mp3",
                "key",
                Duration.ofHours(1)
        )).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void signObjectGetRejectsBaseUrlWithQueryOrFragment() {
        assertThatThrownBy(() -> BunnyTokenUrlSigner.signObjectGet(
                "https://cdn-private.example.test?x=1",
                "alpha/private/audio/ep.mp3",
                "key",
                Duration.ofHours(1)
        )).isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> BunnyTokenUrlSigner.signObjectGet(
                "https://cdn-private.example.test#frag",
                "alpha/private/audio/ep.mp3",
                "key",
                Duration.ofHours(1)
        )).isInstanceOf(IllegalArgumentException.class);
    }

    private static String expectedHs256Token(String path, String expires, String securityKey)
            throws Exception {
        String message = path + expires;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(securityKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] digest = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        return "HS256-" + Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }

    private static String queryParam(String query, String name) {
        for (String part : query.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv[0].equals(name)) {
                return kv[1];
            }
        }
        throw new AssertionError("missing query param: " + name);
    }
}
