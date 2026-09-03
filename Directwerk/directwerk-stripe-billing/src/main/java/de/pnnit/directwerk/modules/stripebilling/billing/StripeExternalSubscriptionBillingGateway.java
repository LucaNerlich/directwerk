package de.pnnit.directwerk.modules.stripebilling.billing;

import de.pnnit.directwerk.modules.stripebilling.StripeConnectService;
import de.pnnit.directwerk.modules.stripebilling.StripeOperations;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeConnectNotReadyException;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeNotConfiguredException;
import de.pnnit.directwerk.modules.subscription.billing.ExternalSubscriptionBillingGateway;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
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
        if (subscription.getSource() != SubscriptionSource.STRIPE
                || subscription.getExternalSubscriptionId() == null
                || !stripeOperations.isConfigured()) {
            return;
        }
        try {
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
        } catch (StripeNotConfiguredException ignored) {
            // Local revoke still applies when the platform key is missing.
        }
    }
}
