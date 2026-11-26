package de.pnnit.directwerk.modules.stripebilling.billing;

import de.pnnit.directwerk.modules.stripebilling.StripeConnectService;
import de.pnnit.directwerk.modules.stripebilling.StripeOperations;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeConnectNotReadyException;
import de.pnnit.directwerk.modules.subscription.billing.ExternalSubscriptionBillingGateway;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import org.springframework.stereotype.Service;

@Service
public class StripeExternalSubscriptionBillingGateway implements ExternalSubscriptionBillingGateway {

    private final StripeOperations stripeOperations;
    private final StripeConnectService stripeConnectService;

    public StripeExternalSubscriptionBillingGateway(
            StripeOperations stripeOperations,
            StripeConnectService stripeConnectService
    ) {
        this.stripeOperations = stripeOperations;
        this.stripeConnectService = stripeConnectService;
    }

    @Override
    public void cancelExternalSubscriptionIfNeeded(Long tenantId, Subscription subscription) {
        // Source is not the signal: a MANUAL grant records the Stripe subscription id so a later
        // revoke can still cancel the live subscription (#1027).
        if (subscription.getExternalSubscriptionId() == null
                || !stripeOperations.isConfigured()) {
            return;
        }
        var account = stripeConnectService.findByTenantId(tenantId);
        if (account == null) {
            // Fail closed: revoking locally while the provider subscription stays live
            // would keep billing the customer, and the next subscription.updated event
            // would resurrect the CANCELED row. Block instead (409 STRIPE_NOT_CONNECTED)
            // so the admin resolves the Connect account first.
            throw new StripeConnectNotReadyException(
                    "Stripe Connect account is missing; revoke blocked to avoid a live provider subscription");
        }
        stripeOperations.cancelSubscription(
                account.getStripeAccountId(),
                subscription.getExternalSubscriptionId()
        );
    }
}
