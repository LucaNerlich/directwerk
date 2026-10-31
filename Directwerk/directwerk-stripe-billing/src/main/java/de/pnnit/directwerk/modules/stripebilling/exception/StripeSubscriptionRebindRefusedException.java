package de.pnnit.directwerk.modules.stripebilling.exception;

/**
 * Raised when a Stripe webhook would rebind an existing local subscription row to a different
 * live Stripe subscription id. The inbound subscription is unbound locally and must be canceled
 * at Stripe so it does not keep billing with no row left to revoke it.
 */
public class StripeSubscriptionRebindRefusedException extends RuntimeException {

    private final Long tenantId;
    private final String refusedExternalSubscriptionId;

    public StripeSubscriptionRebindRefusedException(
            Long tenantId,
            Long subscriptionId,
            String currentExternalId,
            String refusedExternalSubscriptionId
    ) {
        super("Refusing to rebind subscription " + subscriptionId
                + " from " + currentExternalId + " to " + refusedExternalSubscriptionId);
        this.tenantId = tenantId;
        this.refusedExternalSubscriptionId = refusedExternalSubscriptionId;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public String getRefusedExternalSubscriptionId() {
        return refusedExternalSubscriptionId;
    }
}
