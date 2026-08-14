package de.pnnit.directwerk.modules.subscription.stripe;

import de.pnnit.directwerk.modules.subscription.entity.BillingInterval;
import java.time.Instant;
import java.util.Map;

/**
 * Stripe SDK boundary. Tests mock this; production uses {@link StripeSdkOperations}.
 *
 * <p>Charge model: <strong>direct charges on the connected account</strong>
 * ({@code Stripe-Account} header). No application fee in this slice.
 */
public interface StripeOperations {

    boolean isConfigured();

    boolean isWebhookConfigured();

    ConnectedAccount createExpressAccount(String country, Map<String, String> metadata);

    ConnectedAccount retrieveAccount(String accountId);

    String createAccountLink(String accountId, String refreshUrl, String returnUrl);

    CatalogIds upsertProductAndPrice(
            String accountId,
            String existingProductId,
            String title,
            String description,
            long priceCents,
            String currency,
            BillingInterval interval
    );

    String createCustomer(String accountId, String email, Map<String, String> metadata);

    CheckoutSessionResult createCheckoutSession(CheckoutSessionCommand command);

    String createPortalSession(String accountId, String customerId, String returnUrl);

    void cancelSubscription(String accountId, String subscriptionId);

    StripeWebhookPayload parseWebhook(String payload, String signature);

    record ConnectedAccount(
            String accountId,
            boolean chargesEnabled,
            boolean payoutsEnabled,
            boolean detailsSubmitted
    ) {
    }

    record CatalogIds(String productId, String priceId) {
    }

    record CheckoutSessionResult(String sessionId, String url) {
    }

    record CheckoutSessionCommand(
            String accountId,
            String customerId,
            String priceId,
            BillingInterval interval,
            String successUrl,
            String cancelUrl,
            Map<String, String> metadata
    ) {
    }

    record StripeWebhookPayload(
            String eventId,
            String type,
            String connectedAccountId,
            String customerId,
            String subscriptionId,
            String stripePriceId,
            Instant currentPeriodEnd,
            String stripeSubscriptionStatus,
            boolean chargesEnabled,
            boolean payoutsEnabled,
            boolean detailsSubmitted,
            Map<String, String> metadata,
            String paymentIntentId,
            boolean fullyRefunded
    ) {
    }
}
