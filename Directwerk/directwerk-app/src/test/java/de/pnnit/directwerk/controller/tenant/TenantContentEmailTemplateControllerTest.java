package de.pnnit.directwerk.controller.tenant;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.content.ContentType;
import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Issue #579: the template type lookup must not depend on the JVM default locale (Turkish
 * lower-cases "I", which turned ARTICLE into ARTİCLE).
 */
class TenantContentEmailTemplateControllerTest {

    private Locale original;

    @BeforeEach
    void useTurkishDefault() {
        original = Locale.getDefault();
        Locale.setDefault(Locale.forLanguageTag("tr"));
    }

    @AfterEach
    void restoreDefault() {
        Locale.setDefault(original);
    }

    @Test
    void resolvesArticleUnderATurkishDefaultLocale() {
        assertThat(TenantContentEmailTemplateController.parseContentType("article"))
                .isEqualTo(ContentType.ARTICLE);
    }

    @Test
    void resolvesEpisodeUnderATurkishDefaultLocale() {
        assertThat(TenantContentEmailTemplateController.parseContentType("episode"))
                .isEqualTo(ContentType.EPISODE);
    }
}
