package de.pnnit.directwerk.modules.core.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TenantHostnameTest {

    @Test
    void trimsAndLowercases() {
        assertThat(TenantHostname.normalize("  Alpha.Example.TEST  ")).isEqualTo("alpha.example.test");
    }

    @Test
    void rejectsNull() {
        assertThatThrownBy(() -> TenantHostname.normalize(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsEmpty() {
        assertThatThrownBy(() -> TenantHostname.normalize("  "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsLeadingDot() {
        assertThatThrownBy(() -> TenantHostname.normalize(".example.test"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsTrailingDot() {
        assertThatThrownBy(() -> TenantHostname.normalize("example.test."))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsConsecutiveDots() {
        assertThatThrownBy(() -> TenantHostname.normalize("example..test"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsInvalidCharacters() {
        assertThatThrownBy(() -> TenantHostname.normalize("exa_mple.test"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsOverlongHost() {
        assertThatThrownBy(() -> TenantHostname.normalize("a".repeat(254)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsSingleLabelHost() {
        assertThat(TenantHostname.normalize("localhost")).isEqualTo("localhost");
    }
}
