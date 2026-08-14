package de.pnnit.directwerk.modules.core.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class UserTest {

    private Locale previousDefaultLocale;

    @BeforeEach
    void rememberDefaultLocale() {
        previousDefaultLocale = Locale.getDefault();
        Locale.setDefault(Locale.forLanguageTag("tr"));
    }

    @AfterEach
    void restoreDefaultLocale() {
        Locale.setDefault(previousDefaultLocale);
    }

    @Test
    void normalizeEmailTrimsWhitespace() {
        User user = new User();
        user.setEmail("  USER@EXAMPLE.COM  ");

        user.normalizeEmail();

        assertEquals("user@example.com", user.getEmail());
    }

    @Test
    void normalizeEmailUsesRootLocaleOnPersist() {
        User user = new User();
        user.setEmail("USER@EXAMPLE.COM");

        user.normalizeEmail();

        assertEquals("user@example.com", user.getEmail());
    }

    @Test
    void normalizeEmailUsesRootLocaleForTurkishDotlessI() {
        User user = new User();
        user.setEmail("MAIL.I@EXAMPLE.COM");

        user.normalizeEmail();

        assertEquals("mail.i@example.com", user.getEmail());
    }
}
