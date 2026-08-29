package de.pnnit.directwerk.modules.stripebilling.billing;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.stripebilling.StripeConnectService;
import de.pnnit.directwerk.modules.stripebilling.StripeOperations;
import de.pnnit.directwerk.modules.stripebilling.entity.TenantStripeAccount;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeApiException;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StripeExternalSubscriptionBillingGatewayTest {

    @Mock
    private StripeOperations stripeOperations;

    @Mock
    private StripeConnectService stripeConnectService;

    @InjectMocks
    private StripeExternalSubscriptionBillingGateway gateway;

    @Test
    void propagatesStripeCancelFailure() {
        Subscription stripe = new Subscription();
        stripe.setSource(SubscriptionSource.STRIPE);
        stripe.setStatus(SubscriptionStatus.ACTIVE);
        stripe.setExternalSubscriptionId("sub_123");
        TenantStripeAccount account = new TenantStripeAccount();
        account.setStripeAccountId("acct_1");
        when(stripeOperations.isConfigured()).thenReturn(true);
        when(stripeConnectService.findByTenantId(1L)).thenReturn(account);
        doThrow(new StripeApiException("Stripe unavailable"))
                .when(stripeOperations)
                .cancelSubscription("acct_1", "sub_123");

        assertThatThrownBy(() -> gateway.cancelExternalSubscriptionIfNeeded(1L, stripe))
                .isInstanceOf(StripeApiException.class);

        verify(stripeOperations).cancelSubscription("acct_1", "sub_123");
    }
}
