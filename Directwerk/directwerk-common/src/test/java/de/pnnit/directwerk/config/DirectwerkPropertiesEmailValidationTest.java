package de.pnnit.directwerk.config;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

/**
 * Issue #714: the smtp provider was reported ready with a blank sender address or blank base
 * URLs, so every send failed after five retries and invite links were emitted relative.
 */
class DirectwerkPropertiesEmailValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private static DirectwerkProperties withEmail(DirectwerkProperties.Email email) {
        return new DirectwerkProperties(null, null, null, null, email, null, null, null, null);
    }

    private static DirectwerkProperties.Email email(
            String provider, String fromAddress, String studioBaseUrl, String adminBaseUrl) {
        return new DirectwerkProperties.Email(
                provider,
                fromAddress,
                "Directwerk",
                studioBaseUrl,
                adminBaseUrl,
                "/accept-invite",
                "/reset-password",
                "/verify-email",
                7);
    }

    @Test
    void rejectsSmtpWithoutASenderAddress() {
        DirectwerkProperties.Email incomplete =
                email("smtp", " ", "https://studio.example.com", "https://admin.example.com");

        assertThat(validator.validate(withEmail(incomplete)))
                .anyMatch(violation ->
                        violation.getPropertyPath().toString().contains("transportConfigured"));
    }

    @Test
    void rejectsSmtpWithoutBaseUrls() {
        DirectwerkProperties.Email incomplete = email("smtp", "noreply@example.com", "", null);

        assertThat(validator.validate(withEmail(incomplete)))
                .anyMatch(violation ->
                        violation.getPropertyPath().toString().contains("transportConfigured"));
    }

    @Test
    void acceptsCompleteSmtpConfigAndDisabledProvider() {
        assertThat(validator.validate(withEmail(
                        email("smtp", "noreply@example.com", "https://studio.example.com", "https://admin.example.com"))))
                .isEmpty();
        assertThat(validator.validate(withEmail(email("none", "", "", ""))))
                .isEmpty();
    }
}
