package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TokenHashUtilTest {

    @Test
    void generatesUrlSafeTokenOfRequestedLength() {
        String token = TokenHashUtil.generateUrlSafeToken(32);
        assertThat(token).matches("^[A-Za-z0-9_-]+$");
    }

    @Test
    void rejectsBelowMinimumEntropy() {
        assertThatThrownBy(() -> TokenHashUtil.generateUrlSafeToken(15))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsMinimumEntropy() {
        assertThat(TokenHashUtil.generateUrlSafeToken(16)).isNotBlank();
    }

    @Test
    void hashIsDeterministicAndHex() {
        String hash = TokenHashUtil.sha256Hex("my-token");
        assertThat(hash).hasSize(64).matches("^[0-9a-f]+$");
        assertThat(TokenHashUtil.sha256Hex("my-token")).isEqualTo(hash);
    }

    @Test
    void differentInputsHashDifferently() {
        assertThat(TokenHashUtil.sha256Hex("a")).isNotEqualTo(TokenHashUtil.sha256Hex("b"));
    }
}
