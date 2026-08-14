package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.KeyPair;
import java.security.interfaces.RSAPublicKey;
import org.junit.jupiter.api.Test;

class JwtKeySupportTest {

    @Test
    void deriveKeyIdIsStableForSamePublicKey() {
        KeyPair keyPair = JwtKeySupport.resolveKeyPair(null, null);
        RSAPublicKey publicKey = (RSAPublicKey) keyPair.getPublic();

        String first = JwtKeySupport.deriveKeyId(publicKey);
        String second = JwtKeySupport.deriveKeyId(publicKey);

        assertThat(first).isEqualTo(second);
        assertThat(first).hasSize(16);
    }

    @Test
    void rejectsPartialKeyConfiguration() {
        assertThatThrownBy(() -> JwtKeySupport.resolveKeyPair("private-only", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("partial configuration");
        assertThatThrownBy(() -> JwtKeySupport.resolveKeyPair(null, "public-only"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("partial configuration");
    }
}
