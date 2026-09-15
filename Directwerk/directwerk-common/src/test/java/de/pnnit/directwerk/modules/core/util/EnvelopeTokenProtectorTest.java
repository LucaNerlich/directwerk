package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import org.junit.jupiter.api.Test;

/**
 * Pins the shared signed-envelope seam: one key derivation
 * ({@code platformClientSecret + "|" + tenantClientSecret}) and one AES-256-GCM
 * ciphertext format, so the feed and email adapters are interoperable.
 */
class EnvelopeTokenProtectorTest {

    private static final String PLATFORM_SECRET = "platform-secret";
    private static final String TENANT_SECRET = "tenant-secret";

    private final EnvelopeTokenProtector protector =
            new EnvelopeTokenProtector(config(PLATFORM_SECRET, TENANT_SECRET));

    @Test
    void protectsAndRevealsTokenValues() {
        String protectedToken = protector.protect("secret-token");

        assertThat(protectedToken).startsWith("enc:v1:");
        assertThat(protector.reveal(protectedToken)).isEqualTo("secret-token");
    }

    @Test
    void usesPlatformPipeTenantKeyMaterial() {
        String keyMaterial = PLATFORM_SECRET + "|" + TENANT_SECRET;

        // Ciphertext from the module is readable with the raw cipher + expected key material...
        assertThat(EnvelopeCipher.decrypt(protector.protect("secret-token"), keyMaterial))
                .isEqualTo("secret-token");

        // ...and ciphertext from the raw cipher + expected key material is readable by the module.
        assertThat(protector.reveal(EnvelopeCipher.encrypt("other-token", keyMaterial)))
                .isEqualTo("other-token");
    }

    @Test
    void separateInstancesBuiltFromTheSameConfigAreInteroperable() {
        // FeedTokenProtector (directwerk-core) and EmailTokenProtector (directwerk-email) are
        // thin adapters over this module, so a token protected for one context reveals in the other.
        EnvelopeTokenProtector feed = new EnvelopeTokenProtector(config(PLATFORM_SECRET, TENANT_SECRET));
        EnvelopeTokenProtector email = new EnvelopeTokenProtector(config(PLATFORM_SECRET, TENANT_SECRET));

        assertThat(email.reveal(feed.protect("shared-token"))).isEqualTo("shared-token");
        assertThat(feed.reveal(email.protect("shared-token"))).isEqualTo("shared-token");
    }

    @Test
    void legacyUnprefixedValuesPassThrough() {
        assertThat(protector.reveal("legacy-plain-token")).isEqualTo("legacy-plain-token");
    }

    @Test
    void failsClosedWhenClientSecretsAreNotConfigured() {
        EnvelopeTokenProtector unconfigured = new EnvelopeTokenProtector(config("  ", null));

        assertThatThrownBy(() -> unconfigured.protect("secret-token"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("OAuth client secrets must be configured for token protection");
    }

    private static DirectwerkConfig config(String platformSecret, String tenantSecret) {
        DirectwerkProperties.Security security = new DirectwerkProperties.Security(
                null, null, null, null, platformSecret, tenantSecret, null, null, null, null, null, null, null, null);
        return new DirectwerkConfig(new DirectwerkProperties(security, null, null, null, null, null, null, null, null));
    }
}
