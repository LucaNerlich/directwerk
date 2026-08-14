package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class EnvelopeCipherTest {

    @Test
    void encryptsAndDecryptsTokenValues() {
        String encrypted = EnvelopeCipher.encrypt("secret-token", "test-key-material");
        assertThat(encrypted).startsWith("enc:v1:");
        assertThat(EnvelopeCipher.decrypt(encrypted, "test-key-material")).isEqualTo("secret-token");
    }
}
