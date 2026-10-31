package de.pnnit.directwerk.modules.stripebilling.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeSubscriptionRebindRefusedException;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.event.SubscriptionMembershipActivatedEvent;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionProductService;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class StripeSubscriptionSyncServiceTest {

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
    private TenantRepository tenantRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private StripeSubscriptionSyncService service;

    @Test
    void stripeUpsertDoesNotOverwriteActiveManualGrant() {
        User user = user();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        SubscriptionProduct product = product();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);
        Subscription manual = subscription(SubscriptionSource.MANUAL, SubscriptionStatus.ACTIVE);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(TENANT_ID, "sub_late"))
                .thenReturn(Optional.empty());
        when(subscriptionRepository.findByTenantIdAndUserIdAndProductIdForUpdate(TENANT_ID, USER_ID, PRODUCT_ID))
                .thenReturn(Optional.of(manual));
        when(subscriptionRepository.save(manual)).thenReturn(manual);

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

        // The manual grant is preserved, but the Stripe relationship is recorded so later
        // webhooks can find the row.
        assertThat(result).isSameAs(manual);
        assertThat(result.getSource()).isEqualTo(SubscriptionSource.MANUAL);
        assertThat(result.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(result.getExternalSubscriptionId()).isEqualTo("sub_late");
        assertThat(result.getStripeCustomerId()).isEqualTo("cus_1");
        verify(subscriptionRepository).save(manual);
        verify(eventPublisher, never()).publishEvent(any(TenantEntitlementsChangedEvent.class));
    }

    @Test
    void stripeUpsertRefusesToRebindAnExistingStripeSubscription() {
        // #534: the row is keyed by (tenant, user, product), so binding a second Stripe
        // subscription to it would orphan the first — still billed, nothing left to cancel.
        User user = user();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        SubscriptionProduct product = product();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);

        Subscription existing = subscription(SubscriptionSource.STRIPE, SubscriptionStatus.ACTIVE);
        existing.setExternalSubscriptionId("sub_old");
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(TENANT_ID, "sub_new"))
                .thenReturn(Optional.empty());
        when(subscriptionRepository.findByTenantIdAndUserIdAndProductIdForUpdate(TENANT_ID, USER_ID, PRODUCT_ID))
                .thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.upsertStripeSubscription(
                TENANT_ID,
                USER_ID,
                PRODUCT_ID,
                "sub_new",
                "cus_1",
                SubscriptionStatus.ACTIVE,
                null,
                null
        ))
                .isInstanceOf(StripeSubscriptionRebindRefusedException.class)
                .hasMessageContaining("Refusing to rebind")
                .satisfies(ex -> {
                    StripeSubscriptionRebindRefusedException refused =
                            (StripeSubscriptionRebindRefusedException) ex;
                    assertThat(refused.getTenantId()).isEqualTo(TENANT_ID);
                    assertThat(refused.getRefusedExternalSubscriptionId()).isEqualTo("sub_new");
                });

        assertThat(existing.getExternalSubscriptionId()).isEqualTo("sub_old");
    }

    @Test
    void stripeUpsertRebindsACanceledStripeRowToANewSubscription() {
        // #705: a canceled row is terminal at Stripe, so a returning customer's new
        // subscription must take the row over instead of paying into a void.
        User user = user();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        SubscriptionProduct product = product();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);

        Subscription existing = subscription(SubscriptionSource.STRIPE, SubscriptionStatus.CANCELED);
        existing.setExternalSubscriptionId("sub_old");
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(TENANT_ID, "sub_new"))
                .thenReturn(Optional.empty());
        when(subscriptionRepository.findByTenantIdAndUserIdAndProductIdForUpdate(TENANT_ID, USER_ID, PRODUCT_ID))
                .thenReturn(Optional.of(existing));
        when(subscriptionRepository.save(any(Subscription.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

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

        assertThat(result.getExternalSubscriptionId()).isEqualTo("sub_new");
        assertThat(result.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
    }

    @Test
    void stripeUpsertAdoptsCanceledManualRow() {
        User user = user();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        SubscriptionProduct product = product();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);
        Subscription revoked = subscription(SubscriptionSource.MANUAL, SubscriptionStatus.CANCELED);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(TENANT_ID, "sub_new"))
                .thenReturn(Optional.empty());
        when(subscriptionRepository.findByTenantIdAndUserIdAndProductIdForUpdate(TENANT_ID, USER_ID, PRODUCT_ID))
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

    @Test
    void externalIdSyncIgnoresPastDueForCanceledRow() {
        Subscription canceled = subscription(SubscriptionSource.STRIPE, SubscriptionStatus.CANCELED);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(TENANT_ID, "sub_c"))
                .thenReturn(Optional.of(canceled));

        service.syncStripeSubscriptionByExternalId(
                TENANT_ID,
                "sub_c",
                SubscriptionStatus.PAST_DUE,
                null
        );

        // Issue #306: a stale invoice.payment_failed after `deleted` must not rewrite CANCELED.
        assertThat(canceled.getStatus()).isEqualTo(SubscriptionStatus.CANCELED);
        verify(subscriptionRepository, never()).save(canceled);
    }

    @Test
    void stripeUpsertIgnoresIncompleteForCanceledRow() {
        User user = user();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        SubscriptionProduct product = product();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);
        Subscription canceled = subscription(SubscriptionSource.STRIPE, SubscriptionStatus.CANCELED);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(TENANT_ID, "sub_x"))
                .thenReturn(Optional.of(canceled));

        Subscription result = service.upsertStripeSubscription(
                TENANT_ID,
                USER_ID,
                PRODUCT_ID,
                "sub_x",
                "cus_1",
                SubscriptionStatus.INCOMPLETE,
                null,
                null
        );

        assertThat(result.getStatus()).isEqualTo(SubscriptionStatus.CANCELED);
        verify(subscriptionRepository, never()).save(canceled);
    }

    @Test
    void markInvoicePaidReactivatesAndRefreshesPeriodEnd() {
        Subscription overdue = subscription(SubscriptionSource.STRIPE, SubscriptionStatus.PAST_DUE);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(TENANT_ID, "sub_9"))
                .thenReturn(Optional.of(overdue));
        when(subscriptionRepository.save(overdue)).thenReturn(overdue);
        Instant endsAt = Instant.parse("2026-10-01T00:00:00Z");

        service.markInvoicePaid(TENANT_ID, "sub_9", endsAt);

        assertThat(overdue.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(overdue.getEndsAt()).isEqualTo(endsAt);
        verify(eventPublisher).publishEvent(any(TenantEntitlementsChangedEvent.class));
        verify(eventPublisher).publishEvent(any(SubscriptionMembershipActivatedEvent.class));
    }

    @Test
    void markInvoicePaidKeepsPeriodEndWhenInvoiceHasNone() {
        Subscription overdue = subscription(SubscriptionSource.STRIPE, SubscriptionStatus.INCOMPLETE);
        Instant existingEnd = Instant.parse("2026-09-01T00:00:00Z");
        overdue.setEndsAt(existingEnd);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(TENANT_ID, "sub_9"))
                .thenReturn(Optional.of(overdue));
        when(subscriptionRepository.save(overdue)).thenReturn(overdue);

        service.markInvoicePaid(TENANT_ID, "sub_9", null);

        assertThat(overdue.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(overdue.getEndsAt()).isEqualTo(existingEnd);
        verify(eventPublisher).publishEvent(any(SubscriptionMembershipActivatedEvent.class));
    }

    @Test
    void markInvoicePaidNoOpsWhenAlreadyActive() {
        Subscription active = subscription(SubscriptionSource.STRIPE, SubscriptionStatus.ACTIVE);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(TENANT_ID, "sub_9"))
                .thenReturn(Optional.of(active));

        service.markInvoicePaid(TENANT_ID, "sub_9", Instant.parse("2026-10-01T00:00:00Z"));

        verify(subscriptionRepository, never()).save(active);
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void externalIdSyncDoesNotChangeManualEntitlement() {
        Subscription manual = subscription(SubscriptionSource.MANUAL, SubscriptionStatus.ACTIVE);
        Instant existingEnd = Instant.parse("2027-01-01T00:00:00Z");
        manual.setEndsAt(existingEnd);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(TENANT_ID, "sub_late"))
                .thenReturn(Optional.of(manual));

        service.syncStripeSubscriptionByExternalId(
                TENANT_ID,
                "sub_late",
                SubscriptionStatus.CANCELED,
                Instant.parse("2026-10-01T00:00:00Z")
        );

        assertThat(manual.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(manual.getEndsAt()).isEqualTo(existingEnd);
        verify(subscriptionRepository, never()).save(manual);
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
    @Test
    void upsertDeclaresNoRollbackForRebindRefuse() throws Exception {
        // Guards the webhook write-TX commit path: nested REQUIRED must not mark rollback-only
        // when StripeSubscriptionRebindRefusedException is thrown (#944 review).
        Method method = StripeSubscriptionSyncService.class.getMethod(
                "upsertStripeSubscription",
                Long.class,
                Long.class,
                Long.class,
                String.class,
                String.class,
                SubscriptionStatus.class,
                Instant.class,
                String.class);
        Transactional transactional = method.getAnnotation(Transactional.class);
        assertThat(transactional).isNotNull();
        assertThat(transactional.noRollbackFor())
                .containsExactly(StripeSubscriptionRebindRefusedException.class);
    }

}
