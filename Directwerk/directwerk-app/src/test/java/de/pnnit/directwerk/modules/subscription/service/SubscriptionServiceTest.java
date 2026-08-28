package de.pnnit.directwerk.modules.subscription.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import de.pnnit.directwerk.modules.subscription.stripe.StripeConnectService;
import de.pnnit.directwerk.modules.subscription.stripe.StripeOperations;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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
    private StripeOperations stripeOperations;

    @Mock
    private StripeConnectService stripeConnectService;

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
    void stripeUpsertDoesNotOverwriteActiveManualGrant() {
        User user = user();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        SubscriptionProduct product = product();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);
        Subscription manual = subscription(SubscriptionSource.MANUAL, SubscriptionStatus.ACTIVE);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionId(TENANT_ID, "sub_late")).thenReturn(Optional.empty());
        when(subscriptionRepository.findByTenantIdAndUserIdAndProductId(TENANT_ID, USER_ID, PRODUCT_ID))
                .thenReturn(Optional.of(manual));

        Subscription result = service.upsertStripeSubscription(
                TENANT_ID,
                USER_ID,
                PRODUCT_ID,
                "sub_late",
                "cus_1",
                SubscriptionStatus.CANCELED,
                null,
                null
        );

        assertThat(result).isSameAs(manual);
        assertThat(result.getSource()).isEqualTo(SubscriptionSource.MANUAL);
        assertThat(result.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        verify(subscriptionRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any(TenantEntitlementsChangedEvent.class));
    }

    @Test
    void stripeUpsertAdoptsCanceledManualRow() {
        User user = user();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        SubscriptionProduct product = product();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);
        Subscription revoked = subscription(SubscriptionSource.MANUAL, SubscriptionStatus.CANCELED);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionId(TENANT_ID, "sub_new")).thenReturn(Optional.empty());
        when(subscriptionRepository.findByTenantIdAndUserIdAndProductId(TENANT_ID, USER_ID, PRODUCT_ID))
                .thenReturn(Optional.of(revoked));
        when(subscriptionRepository.save(revoked)).thenReturn(revoked);

        Subscription result = service.upsertStripeSubscription(
                TENANT_ID,
                USER_ID,
                PRODUCT_ID,
                "sub_new",
                "cus_1",
                SubscriptionStatus.ACTIVE,
                null,
                null
        );

        assertThat(result.getSource()).isEqualTo(SubscriptionSource.STRIPE);
        assertThat(result.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(result.getExternalSubscriptionId()).isEqualTo("sub_new");
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
