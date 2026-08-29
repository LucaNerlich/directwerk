package de.pnnit.directwerk.modules.stripebilling.stripe;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.stripebilling.StripeConnectService;
import de.pnnit.directwerk.modules.stripebilling.StripeOperations;
import de.pnnit.directwerk.modules.stripebilling.StripeWebhookService;
import de.pnnit.directwerk.modules.stripebilling.entity.TenantStripeAccount;
import de.pnnit.directwerk.modules.stripebilling.repository.ProcessedWebhookEventRepository;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionProductRepository;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import de.pnnit.directwerk.modules.stripebilling.service.StripeSubscriptionSyncService;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StripeWebhookServiceTest {

    @Mock
    private StripeOperations stripeOperations;

    @Mock
    private StripeConnectService stripeConnectService;

    @Mock
    private StripeSubscriptionSyncService stripeSubscriptionSyncService;

    @Mock
    private SubscriptionProductRepository subscriptionProductRepository;

    @Mock
    private ProcessedWebhookEventRepository processedWebhookEventRepository;

    @Mock
    private SubscriptionRepository subscriptionRepository;

    private StripeWebhookService service;

    @BeforeEach
    void setUp() {
        service = new StripeWebhookService(
                stripeOperations,
                stripeConnectService,
                stripeSubscriptionSyncService,
                subscriptionProductRepository,
                processedWebhookEventRepository,
                subscriptionRepository
        );
    }

    @Test
    void checkoutCompletedCreatesStripeSubscription() {
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

        verify(stripeSubscriptionSyncService).upsertStripeSubscription(
                7L,
                3L,
                11L,
                "sub_1",
                "cus_1",
                SubscriptionStatus.ACTIVE,
                Instant.parse("2026-09-01T00:00:00Z"),
                "pi_1"
        );
    }

    @Test
    void staleUpdatedDoesNotResurrectCanceledSubscription() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_stale",
                "customer.subscription.updated",
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
                null,
                false
        );
        when(stripeOperations.parseWebhook("{}", "t=1,v1=sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_stale", "customer.subscription.updated", "acct_1"))
                .thenReturn(1);
        TenantStripeAccount account = account(7L, "acct_1");
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account);

        Subscription canceled = new Subscription();
        canceled.setStatus(SubscriptionStatus.CANCELED);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionId(7L, "sub_1"))
                .thenReturn(Optional.of(canceled));
        // Live Stripe says canceled too — a stale event must not reactivate.
        when(stripeOperations.retrieveSubscriptionStatus("acct_1", "sub_1")).thenReturn("canceled");

        service.handle("{}", "t=1,v1=sig");

        verify(stripeSubscriptionSyncService, never()).upsertStripeSubscription(
                any(), any(), any(), any(), any(), any(), any(), any()
        );
    }

    @Test
    void updatedAppliesWhenLiveLookupConfirmsActive() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_live",
                "customer.subscription.updated",
                "acct_1",
                "cus_1",
                "sub_2",
                "price_1",
                Instant.parse("2026-09-01T00:00:00Z"),
                "active",
                true,
                true,
                true,
                Map.of("tenant_id", "7", "user_id", "3", "product_id", "11"),
                null,
                false
        );
        when(stripeOperations.parseWebhook("{}", "t=1,v1=sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_live", "customer.subscription.updated", "acct_1"))
                .thenReturn(1);
        TenantStripeAccount account = account(7L, "acct_1");
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account);
        // No local CANCELED row → no live lookup needed, straight upsert.
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionId(7L, "sub_2"))
                .thenReturn(Optional.empty());

        service.handle("{}", "t=1,v1=sig");

        verify(stripeOperations, never()).retrieveSubscriptionStatus(any(), any());
        verify(stripeSubscriptionSyncService).upsertStripeSubscription(
                eq(7L), eq(3L), eq(11L), eq("sub_2"), eq("cus_1"),
                eq(SubscriptionStatus.ACTIVE),
                eq(Instant.parse("2026-09-01T00:00:00Z")),
                isNull()
        );
    }

    @Test
    void replayIsIgnored() {        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
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

        verify(stripeSubscriptionSyncService, never()).upsertStripeSubscription(
                any(), any(), any(), any(), any(), any(), any(), any()
        );
        verify(stripeSubscriptionSyncService, never()).syncStripeSubscriptionByExternalId(any(), any(), any(), any());
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

        verify(stripeSubscriptionSyncService).syncStripeSubscriptionByExternalId(
                eq(7L),
                eq("sub_9"),
                eq(SubscriptionStatus.PAST_DUE),
                eq(null)
        );
    }

    @Test
    void pausedSubscriptionStatusMapsToPastDue() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_paused",
                "customer.subscription.updated",
                "acct_1",
                "cus_1",
                "sub_9",
                null,
                null,
                "paused",
                true,
                true,
                true,
                Map.of(),
                null,
                false
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_paused", "customer.subscription.updated", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.handle("{}", "sig");

        verify(stripeSubscriptionSyncService).syncStripeSubscriptionByExternalId(
                eq(7L),
                eq("sub_9"),
                eq(SubscriptionStatus.PAST_DUE),
                eq(null)
        );
    }

    @Test
    void unknownSubscriptionStatusFailsClosedToPastDue() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_unknown",
                "customer.subscription.updated",
                "acct_1",
                "cus_1",
                "sub_9",
                null,
                null,
                "some_future_status",
                true,
                true,
                true,
                Map.of(),
                null,
                false
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_unknown", "customer.subscription.updated", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.handle("{}", "sig");

        verify(stripeSubscriptionSyncService).syncStripeSubscriptionByExternalId(
                eq(7L),
                eq("sub_9"),
                eq(SubscriptionStatus.PAST_DUE),
                eq(null)
        );
    }

    @Test
    void invoicePaidOnlyReactivatesOverdueSubscriptions() {        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
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

        verify(stripeSubscriptionSyncService).markInvoicePaid(7L, "sub_9");
        verify(stripeSubscriptionSyncService, never()).syncStripeSubscriptionByExternalId(any(), any(), any(), any());
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

        verify(stripeSubscriptionSyncService).cancelStripeOneTimeByPaymentId(7L, "pi_refund");
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

        verify(stripeSubscriptionSyncService, never()).cancelStripeOneTimeByPaymentId(any(), any());
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
