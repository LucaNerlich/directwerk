package de.pnnit.directwerk.modules.subscription.stripe;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.entity.TenantStripeAccount;
import de.pnnit.directwerk.modules.subscription.repository.ProcessedWebhookEventRepository;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionProductRepository;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionService;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class StripeWebhookServiceTest {

    @Mock
    private StripeOperations stripeOperations;

    @Mock
    private StripeConnectService stripeConnectService;

    @Mock
    private SubscriptionService subscriptionService;

    @Mock
    private SubscriptionProductRepository subscriptionProductRepository;

    @Mock
    private ProcessedWebhookEventRepository processedWebhookEventRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private StripeWebhookService service;

    @BeforeEach
    void setUp() {
        service = new StripeWebhookService(
                stripeOperations,
                stripeConnectService,
                subscriptionService,
                subscriptionProductRepository,
                processedWebhookEventRepository,
                eventPublisher
        );
    }

    @Test
    void checkoutCompletedCreatesStripeSubscriptionAndFeedEvent() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_1",
                "checkout.session.completed",
                "acct_1",
                "cus_1",
                "sub_1",
                "price_1",
                Instant.parse("2026-09-01T00:00:00Z"),
                "active",
                true,
                true,
                true,
                Map.of("tenant_id", "7", "user_id", "3", "product_id", "11"),
                "pi_1",
                false
        );
        when(stripeOperations.parseWebhook("{}", "t=1,v1=sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_1", "checkout.session.completed", "acct_1"))
                .thenReturn(1);
        TenantStripeAccount account = account(7L, "acct_1");
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account);
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(11L);
        when(subscriptionProductRepository.findByIdAndTenantId(11L, 7L)).thenReturn(Optional.of(product));

        service.handle("{}", "t=1,v1=sig");

        verify(subscriptionService).upsertStripeSubscription(
                7L,
                3L,
                11L,
                "sub_1",
                "cus_1",
                SubscriptionStatus.ACTIVE,
                Instant.parse("2026-09-01T00:00:00Z"),
                "pi_1"
        );
        verify(eventPublisher).publishEvent(new StripeMembershipActivatedEvent(7L, 3L));
    }

    @Test
    void replayIsIgnored() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_dup",
                "checkout.session.completed",
                "acct_1",
                null,
                null,
                null,
                null,
                null,
                false,
                false,
                false,
                Map.of(),
                null,
                false
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_dup", "checkout.session.completed", "acct_1"))
                .thenReturn(0);

        service.handle("{}", "sig");

        verify(subscriptionService, never()).upsertStripeSubscription(
                any(), any(), any(), any(), any(), any(), any(), any()
        );
        verify(subscriptionService, never()).syncStripeSubscriptionByExternalId(any(), any(), any(), any());
    }

    @Test
    void paymentFailedMarksPastDue() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_fail",
                "invoice.payment_failed",
                "acct_1",
                "cus_1",
                "sub_9",
                null,
                null,
                "past_due",
                true,
                true,
                true,
                Map.of(),
                null,
                false
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_fail", "invoice.payment_failed", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.handle("{}", "sig");

        verify(subscriptionService).syncStripeSubscriptionByExternalId(
                eq(7L),
                eq("sub_9"),
                eq(SubscriptionStatus.PAST_DUE),
                eq(null)
        );
    }

    @Test
    void invoicePaidOnlyReactivatesOverdueSubscriptions() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_invoice",
                "invoice.paid",
                "acct_1",
                "cus_1",
                "sub_9",
                null,
                null,
                null,
                true,
                true,
                true,
                Map.of(),
                null,
                false
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_invoice", "invoice.paid", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.handle("{}", "sig");

        verify(subscriptionService).markInvoicePaid(7L, "sub_9");
        verify(subscriptionService, never()).syncStripeSubscriptionByExternalId(any(), any(), any(), any());
    }

    @Test
    void fullRefundCancelsOneTimeGrant() {        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_ref",
                "charge.refunded",
                "acct_1",
                "cus_1",
                null,
                null,
                null,
                null,
                true,
                true,
                true,
                Map.of(),
                "pi_refund",
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_ref", "charge.refunded", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.handle("{}", "sig");

        verify(subscriptionService).cancelStripeOneTimeByPaymentId(7L, "pi_refund");
    }

    @Test
    void partialRefundDoesNotCancelOneTimeGrant() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_partial",
                "charge.refunded",
                "acct_1",
                "cus_1",
                null,
                null,
                null,
                null,
                true,
                true,
                true,
                Map.of(),
                "pi_partial",
                false
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_partial", "charge.refunded", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.handle("{}", "sig");

        verify(subscriptionService, never()).cancelStripeOneTimeByPaymentId(any(), any());
    }

    private static TenantStripeAccount account(Long tenantId, String stripeAccountId) {
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        TenantStripeAccount account = new TenantStripeAccount();
        account.setTenant(tenant);
        account.setStripeAccountId(stripeAccountId);
        return account;
    }
}
