package de.pnnit.directwerk.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class EmailPropertiesTest {

    @Test
    void blanksDefaultToSmtpAndIsDeliveryReady() {
        DirectwerkProperties.Email email = new DirectwerkProperties.Email(
                " ",
                "noreply@directwerk.local",
                "Directwerk",
                "http://localhost:3004",
                "http://localhost:3001",
                "/accept-invite",
                "/reset-password",
                "/verify-email",
                7L
        );
        assertThat(email.provider()).isEqualTo("smtp");
        assertThat(email.isDeliveryReady()).isTrue();
    }

    @Test
    void noneProviderIsNotDeliveryReady() {
        DirectwerkProperties.Email email = new DirectwerkProperties.Email(
                "NONE",
                "noreply@directwerk.local",
                "Directwerk",
                "http://localhost:3004",
                "http://localhost:3001",
                "/accept-invite",
                "/reset-password",
                "/verify-email",
                7L
        );
        assertThat(email.provider()).isEqualTo("none");
        assertThat(email.isDeliveryReady()).isFalse();
        DirectwerkConfig config = new DirectwerkConfig(new DirectwerkProperties(
                null,
                null,
                null,
                null,
                email,
                null,
                null,
                null,
                null
        ));
        assertThat(config.isEmailEnabled()).isFalse();
    }
}
