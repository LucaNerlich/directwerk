package de.pnnit.directwerk.modules.stripebilling;

import static org.junit.jupiter.api.Assertions.assertThrows;

import de.pnnit.directwerk.modules.stripebilling.exception.StripeNotConfiguredException;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeSignatureException;
import org.junit.jupiter.api.Test;

/**
 * Issue #308: the signature check is the single control protecting every money-moving webhook,
 * and it was untested for both the missing-header and invalid-signature rejections.
 */
class StripeSdkOperationsWebhookTest {

    private static final String PAYLOAD = "{\"id\":\"evt_1\",\"type\":\"account.updated\"}";

    private StripeSdkOperations configuredOperations() {
        return new StripeSdkOperations(new StripeProperties("sk_test_1", "pk_test_1", "whsec_test", null));
    }

    @Test
    void rejectsBlankSignature() {
        assertThrows(StripeSignatureException.class, () -> configuredOperations().parseWebhook(PAYLOAD, ""));
    }

    @Test
    void rejectsMissingSignature() {
        assertThrows(StripeSignatureException.class, () -> configuredOperations().parseWebhook(PAYLOAD, null));
    }

    @Test
    void rejectsInvalidSignature() {
        assertThrows(
                StripeSignatureException.class,
                () -> configuredOperations().parseWebhook(PAYLOAD, "t=1234567890,v1=deadbeef"));
    }

    @Test
    void rejectsWhenWebhookSecretIsNotConfigured() {
        StripeSdkOperations unconfigured =
                new StripeSdkOperations(new StripeProperties("", "", "", null));

        assertThrows(StripeNotConfiguredException.class, () -> unconfigured.parseWebhook(PAYLOAD, "t=1,v1=x"));
    }
}
