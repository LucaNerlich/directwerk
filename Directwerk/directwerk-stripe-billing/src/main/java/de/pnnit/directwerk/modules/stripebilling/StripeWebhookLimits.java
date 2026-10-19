package de.pnnit.directwerk.modules.stripebilling;

/**
 * Transport limits for the Stripe webhook endpoint.
 */
public final class StripeWebhookLimits {

    /**
     * Upper bound for {@code POST /api/v1/webhooks/stripe} before JSON binding.
     * Stripe events are a few KB; the cap only has to stop an anonymous peer from
     * materialising an unbounded body before the signature check runs (issue #546).
     */
    public static final int MAX_REQUEST_BODY_BYTES = 1_048_576;

    private StripeWebhookLimits() {
    }
}
