package de.pnnit.directwerk.modules.subscription.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ProductSlugTest {

    @Test
    void normalizeLowercasesAndTrims() {
        assertThat(ProductSlug.normalize(" Supporter-1 ")).isEqualTo("supporter-1");
    }

    @Test
    void normalizeRejectsInvalidSlug() {
        assertThatThrownBy(() -> ProductSlug.normalize("_bad"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
