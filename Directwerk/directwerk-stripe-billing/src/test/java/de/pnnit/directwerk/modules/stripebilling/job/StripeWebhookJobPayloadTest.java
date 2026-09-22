package de.pnnit.directwerk.modules.stripebilling.job;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import de.pnnit.directwerk.modules.stripebilling.StripeOperations;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

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
}
