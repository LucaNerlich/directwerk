package de.pnnit.directwerk.modules.subscription.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.subscription.billing.ExternalSubscriptionBillingGateway;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class SubscriptionServiceTest {

    private static final Long TENANT_ID = 1L;
    private static final Long USER_ID = 5L;
    private static final Long PRODUCT_ID = 7L;

    @Mock
    private SubscriptionRepository subscriptionRepository;

    @Mock
    private SubscriptionProductService subscriptionProductService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private ObjectProvider<ExternalSubscriptionBillingGateway> externalBillingGateway;

    @Mock
    private ExternalSubscriptionBillingGateway billingGateway;

    @InjectMocks
    private SubscriptionService service;

    @Test
    void grantManualSubscriptionRejectsActiveStripeSubscription() {
        mockUserAndMembership();
        SubscriptionProduct product = product();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);
        Subscription stripe = subscription(SubscriptionSource.STRIPE, SubscriptionStatus.ACTIVE);
        when(subscriptionRepository.findByTenantIdAndUserIdAndProductId(TENANT_ID, USER_ID, PRODUCT_ID))
                .thenReturn(Optional.of(stripe));

        assertThatThrownBy(() -> service.grantManualSubscription(TENANT_ID, "user@example.com", PRODUCT_ID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("active Stripe subscription");

        verify(subscriptionRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void grantManualSubscriptionClearsExternalIdsWhenConvertingStripeRow() {
        mockUserAndMembership();
        SubscriptionProduct product = product();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);
        Subscription stripe = subscription(SubscriptionSource.STRIPE, SubscriptionStatus.CANCELED);
        stripe.setExternalSubscriptionId("sub_123");
        stripe.setExternalPaymentId("in_456");
        when(subscriptionRepository.findByTenantIdAndUserIdAndProductId(TENANT_ID, USER_ID, PRODUCT_ID))
                .thenReturn(Optional.of(stripe));
        when(subscriptionRepository.save(stripe)).thenReturn(stripe);

        Subscription granted = service.grantManualSubscription(TENANT_ID, "user@example.com", PRODUCT_ID);

        assertThat(granted.getSource()).isEqualTo(SubscriptionSource.MANUAL);
        assertThat(granted.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(granted.getExternalSubscriptionId()).isNull();
        assertThat(granted.getExternalPaymentId()).isNull();
    }

    @Test
    void revokeSubscriptionDoesNotApplyLocalCancelWhenExternalBillingFails() {
        Subscription stripe = subscription(SubscriptionSource.STRIPE, SubscriptionStatus.ACTIVE);
        stripe.setId(99L);
        stripe.setExternalSubscriptionId("sub_123");
        when(subscriptionRepository.findByIdAndTenantId(99L, TENANT_ID)).thenReturn(Optional.of(stripe));
        doAnswer(invocation -> {
            invocation.<java.util.function.Consumer<ExternalSubscriptionBillingGateway>>getArgument(0)
                    .accept(billingGateway);
            return null;
        }).when(externalBillingGateway).ifAvailable(any());
        doThrow(new RuntimeException("Stripe unavailable"))
                .when(billingGateway)
                .cancelExternalSubscriptionIfNeeded(TENANT_ID, stripe);

        assertThatThrownBy(() -> service.revokeSubscription(TENANT_ID, 99L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Stripe unavailable");

        verify(subscriptionRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    private void mockUserAndMembership() {
        User user = user();
        when(userRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));
        TenantMembership membership = new TenantMembership();
        membership.setUser(user);
        membership.setStatus(MembershipStatus.ACTIVE);
        when(tenantMembershipRepository.findByUserIdAndTenantId(USER_ID, TENANT_ID)).thenReturn(Optional.of(membership));
    }

    private static User user() {
        User user = new User();
        user.setId(USER_ID);
        user.setEmail("user@example.com");
        return user;
    }

    private static SubscriptionProduct product() {
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(PRODUCT_ID);
        product.setActive(true);
        return product;
    }

    private static Subscription subscription(SubscriptionSource source, SubscriptionStatus status) {
        Subscription subscription = new Subscription();
        subscription.setUser(user());
        subscription.setProduct(product());
        subscription.setSource(source);
        subscription.setStatus(status);
        return subscription;
    }
}
