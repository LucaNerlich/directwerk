package de.pnnit.directwerk.modules.stripebilling.job;

import de.pnnit.directwerk.modules.stripebilling.StripeOperations;
import java.time.Instant;
import java.util.Map;

/**
 * Serializable queue payload for a verified Stripe webhook event.
 * Signature verification happens at HTTP ingress; the worker applies idempotent side effects.
 */
public record StripeWebhookJobPayload(
        String eventId,
        String type,
        String connectedAccountId,
        String customerId,
        String subscriptionId,
        String stripePriceId,
        String currentPeriodEnd,
        String stripeSubscriptionStatus,
        boolean chargesEnabled,
        boolean payoutsEnabled,
        boolean detailsSubmitted,
        Map<String, String> metadata,
        String paymentIntentId,
        boolean fullyRefunded
) {

    public static StripeWebhookJobPayload from(StripeOperations.StripeWebhookPayload event) {
        return new StripeWebhookJobPayload(
                event.eventId(),
                event.type(),
                event.connectedAccountId(),
                event.customerId(),
                event.subscriptionId(),
                event.stripePriceId(),
                event.currentPeriodEnd() == null ? null : event.currentPeriodEnd().toString(),
                event.stripeSubscriptionStatus(),
                event.chargesEnabled(),
                event.payoutsEnabled(),
                event.detailsSubmitted(),
                event.metadata(),
                event.paymentIntentId(),
                event.fullyRefunded()
        );
    }

    public StripeOperations.StripeWebhookPayload toStripeWebhookPayload() {
        Instant periodEnd = currentPeriodEnd == null || currentPeriodEnd.isBlank()
                ? null
                : Instant.parse(currentPeriodEnd);
        return new StripeOperations.StripeWebhookPayload(
                eventId,
                type,
                connectedAccountId,
                customerId,
                subscriptionId,
                stripePriceId,
                periodEnd,
                stripeSubscriptionStatus,
                chargesEnabled,
                payoutsEnabled,
                detailsSubmitted,
                metadata == null ? Map.of() : metadata,
                paymentIntentId,
                fullyRefunded
        );
    }
}
