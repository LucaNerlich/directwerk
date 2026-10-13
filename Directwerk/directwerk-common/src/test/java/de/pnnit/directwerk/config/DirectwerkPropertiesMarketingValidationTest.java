package de.pnnit.directwerk.config;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Issue #302: {@code @Valid Marketing marketing} cascaded only into Marketing's own annotated
 * components and then stopped, so the {@code @Positive} constraints on {@code Contact} and
 * {@code Altcha} were never evaluated — a bad env value silently disabled rate limiting or made
 * every ALTCHA challenge pre-expired.
 */
class DirectwerkPropertiesMarketingValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private static DirectwerkProperties withMarketing(DirectwerkProperties.Marketing marketing) {
        return new DirectwerkProperties(null, null, null, null, null, null, null, null, marketing);
    }

    @Test
    void rejectsNonPositiveContactRateLimit() {
        DirectwerkProperties.Contact contact =
                new DirectwerkProperties.Contact(true, "inbox@example.com", 0, List.of(), null);

        assertThat(validator.validate(withMarketing(new DirectwerkProperties.Marketing(contact))))
                .anyMatch(violation ->
                        violation.getPropertyPath().toString().contains("rateLimitPerMinute"));
    }

    @Test
    void rejectsNonPositiveAltchaExpiry() {
        DirectwerkProperties.Altcha altcha = new DirectwerkProperties.Altcha("hmac", -1);
        DirectwerkProperties.Contact contact =
                new DirectwerkProperties.Contact(true, "inbox@example.com", 5, List.of(), altcha);

        assertThat(validator.validate(withMarketing(new DirectwerkProperties.Marketing(contact))))
                .anyMatch(violation ->
                        violation.getPropertyPath().toString().contains("expiresSeconds"));
    }

    @Test
    void acceptsValidContactAndAltchaValues() {
        DirectwerkProperties.Altcha altcha = new DirectwerkProperties.Altcha("hmac", 300);
        DirectwerkProperties.Contact contact =
                new DirectwerkProperties.Contact(true, "inbox@example.com", 5, List.of(), altcha);

        assertThat(validator.validate(withMarketing(new DirectwerkProperties.Marketing(contact))))
                .isEmpty();
    }
}
