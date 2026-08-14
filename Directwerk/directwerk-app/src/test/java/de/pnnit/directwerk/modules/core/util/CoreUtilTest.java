package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class CoreUtilTest {

    @Test
    void emailNormalizerTrimsAndLowercases() {
        assertThat(EmailNormalizer.normalize(" Admin@Example.com ")).isEqualTo("admin@example.com");
    }

    @Test
    void emailNormalizerRejectsBlank() {
        assertThatThrownBy(() -> EmailNormalizer.normalize(" "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void passwordPolicyEnforcesLength() {
        assertThatThrownBy(() -> PasswordPolicy.validate("short"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("8 and 128");
        PasswordPolicy.validate("valid-password");
    }

    @Test
    void tokenHashUtilGeneratesDistinctTokens() {
        String first = TokenHashUtil.generateUrlSafeToken(32);
        String second = TokenHashUtil.generateUrlSafeToken(32);
        assertThat(first).isNotEqualTo(second);
        assertThat(TokenHashUtil.sha256Hex(first)).isNotEqualTo(first);
    }

    @Test
    void slugNormalizerNormalizesProductLikeSlug() {
        assertThat(SlugNormalizer.normalize(" Supporter-1 ")).isEqualTo("supporter-1");
    }
}
