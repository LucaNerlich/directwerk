package de.pnnit.directwerk.modules.stripebilling.job;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import de.pnnit.directwerk.modules.stripebilling.StripeOperations;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class StripeWebhookJobPayloadTest {

    @Test
    void roundTripsPaymentStatusAndDeserializationFlag() {
        StripeOperations.StripeWebhookPayload event = new StripeOperations.StripeWebhookPayload(
                "evt_1",
                "checkout.session.completed",
                "acct_1",
                "cus_1",
                "sub_1",
                "price_1",
                Instant.parse("2026-09-01T00:00:00Z"),
                "active",
                true,
                true,
                true,
                Map.of("tenant_id", "7"),
                "pi_1",
                false,
                "unpaid",
                false
        );

        StripeOperations.StripeWebhookPayload restored =
                StripeWebhookJobPayload.from(event).toStripeWebhookPayload();

        assertEquals("unpaid", restored.paymentStatus());
        assertFalse(restored.dataObjectDeserialized());
        assertEquals(event.currentPeriodEnd(), restored.currentPeriodEnd());
        assertEquals(event.metadata(), restored.metadata());
    }

    @Test
    void roundTripsDeserializedFlag() {
        StripeOperations.StripeWebhookPayload event = new StripeOperations.StripeWebhookPayload(
                "evt_2",
                "account.updated",
                "acct_1",
                null,
                null,
                null,
                null,
                null,
                true,
                true,
                true,
                Map.of(),
                null,
                false,
                null,
                true
        );

        StripeOperations.StripeWebhookPayload restored =
                StripeWebhookJobPayload.from(event).toStripeWebhookPayload();

        assertTrue(restored.dataObjectDeserialized());
        assertTrue(restored.chargesEnabled());
    }

    @Test
    void legacyCheckoutPayloadWithoutPaymentStatusKeepsPriorPaidBehavior() {
        StripeWebhookJobPayload legacy = new ObjectMapper().convertValue(Map.of(
                "eventId", "evt_legacy_checkout",
                "type", "checkout.session.completed",
                "chargesEnabled", false,
                "payoutsEnabled", false,
                "detailsSubmitted", false,
                "fullyRefunded", false,
                "metadata", Map.of("tenant_id", "7")
        ), StripeWebhookJobPayload.class);

        StripeOperations.StripeWebhookPayload restored = legacy.toStripeWebhookPayload();

        assertEquals("paid", restored.paymentStatus());
    }

    @Test
    void legacyAccountPayloadDoesNotLoseCapabilityChanges() {
        StripeWebhookJobPayload legacy = new ObjectMapper().convertValue(Map.of(
                "eventId", "evt_legacy_account",
                "type", "account.updated",
                "connectedAccountId", "acct_1",
                "chargesEnabled", true,
                "payoutsEnabled", true,
                "detailsSubmitted", true,
                "fullyRefunded", false,
                "metadata", Map.of()
        ), StripeWebhookJobPayload.class);

        StripeOperations.StripeWebhookPayload restored = legacy.toStripeWebhookPayload();

        assertTrue(restored.dataObjectDeserialized());
        assertTrue(restored.chargesEnabled());
    }
}
