package de.pnnit.directwerk.modules.stripebilling.stripe;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
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
import de.pnnit.directwerk.modules.stripebilling.exception.StripeSubscriptionRebindRefusedException;
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
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

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

    @Mock
    private PlatformTransactionManager transactionManager;

    private StripeWebhookService service;

    @BeforeEach
    void setUp() {
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        // Prefetch may probe local cancellation before event-specific stubs run.
        lenient().when(subscriptionRepository.findByTenantIdAndExternalSubscriptionId(any(), any()))
                .thenReturn(Optional.empty());
        service = new StripeWebhookService(
                stripeOperations,
                stripeConnectService,
                stripeSubscriptionSyncService,
                subscriptionProductRepository,
                processedWebhookEventRepository,
                subscriptionRepository,
                transactionManager
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
                false,
                "paid",
                true
        );
        when(stripeOperations.parseWebhook("{}", "t=1,v1=sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_1", "checkout.session.completed", "acct_1"))
                .thenReturn(1);
        TenantStripeAccount account = account(7L, "acct_1");
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account);
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(11L);
        when(subscriptionProductRepository.findByIdAndTenantId(11L, 7L)).thenReturn(Optional.of(product));

        service.applyParsedEvent(service.parseAndValidate("{}", "t=1,v1=sig"));

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
                false,
                null,
                true
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

        service.applyParsedEvent(service.parseAndValidate("{}", "t=1,v1=sig"));

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
                false,
                null,
                true
        );
        when(stripeOperations.parseWebhook("{}", "t=1,v1=sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_live", "customer.subscription.updated", "acct_1"))
                .thenReturn(1);
        TenantStripeAccount account = account(7L, "acct_1");
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account);
        // The local row is CANCELED; live Stripe confirms active, so the guard must lock the
        // row (after the HTTP call) and let the upsert through.
        Subscription canceled = new Subscription();
        canceled.setStatus(SubscriptionStatus.CANCELED);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionId(7L, "sub_2"))
                .thenReturn(Optional.of(canceled));
        when(stripeOperations.retrieveSubscriptionStatus("acct_1", "sub_2")).thenReturn("active");
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(7L, "sub_2"))
                .thenReturn(Optional.of(canceled));

        service.applyParsedEvent(service.parseAndValidate("{}", "t=1,v1=sig"));

        verify(stripeOperations).retrieveSubscriptionStatus("acct_1", "sub_2");
        // Issue #745: the provider HTTP call must finish before the write transaction opens;
        // issue #547: the row lock is taken only after that, inside the short transaction.
        InOrder inOrder = inOrder(subscriptionRepository, stripeOperations, transactionManager);
        inOrder.verify(subscriptionRepository)
                .findByTenantIdAndExternalSubscriptionId(7L, "sub_2");
        inOrder.verify(stripeOperations).retrieveSubscriptionStatus("acct_1", "sub_2");
        inOrder.verify(transactionManager).getTransaction(any());
        inOrder.verify(subscriptionRepository)
                .findByTenantIdAndExternalSubscriptionIdForUpdate(7L, "sub_2");
        verify(stripeSubscriptionSyncService).upsertStripeSubscription(
                eq(7L), eq(3L), eq(11L), eq("sub_2"), eq("cus_1"),
                eq(SubscriptionStatus.ACTIVE),
                eq(Instant.parse("2026-09-01T00:00:00Z")),
                isNull()
        );
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
                false,
                "paid",
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_dup", "checkout.session.completed", "acct_1"))
                .thenReturn(0);

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

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
                false,
                null,
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_fail", "invoice.payment_failed", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

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
                false,
                null,
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_paused", "customer.subscription.updated", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

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
                false,
                null,
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_unknown", "customer.subscription.updated", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

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
                Instant.parse("2026-10-01T00:00:00Z"),
                null,
                true,
                true,
                true,
                Map.of(),
                null,
                false,
                null,
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_invoice", "invoice.paid", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

        verify(stripeSubscriptionSyncService).markInvoicePaid(
                7L, "sub_9", Instant.parse("2026-10-01T00:00:00Z"));
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
                true,
                null,
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_ref", "charge.refunded", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

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
                false,
                null,
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_partial", "charge.refunded", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

        verify(stripeSubscriptionSyncService, never()).cancelStripeOneTimeByPaymentId(any(), any());
    }

    @Test
    void checkoutCompletedWithMismatchedTenantMetadataIsIgnored() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_xtenant",
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
                Map.of("tenant_id", "8", "user_id", "3", "product_id", "11"),
                "pi_1",
                false,
                "paid",
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_xtenant", "checkout.session.completed", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

        verify(stripeSubscriptionSyncService, never()).upsertStripeSubscription(
                any(), any(), any(), any(), any(), any(), any(), any()
        );
        verify(subscriptionProductRepository, never()).findByIdAndTenantId(any(), any());
    }

    @Test
    void subscriptionUpdatedWithGarbledTenantMetadataIsIgnored() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_garbled",
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
                Map.of("tenant_id", "not-a-number", "user_id", "3", "product_id", "11"),
                null,
                false,
                null,
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_garbled", "customer.subscription.updated", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

        verify(stripeSubscriptionSyncService, never()).upsertStripeSubscription(
                any(), any(), any(), any(), any(), any(), any(), any()
        );
        verify(stripeSubscriptionSyncService, never()).syncStripeSubscriptionByExternalId(any(), any(), any(), any());
    }

    @Test
    void subscriptionUpdatedPrefersLivePriceOverStaleMetadata() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_downgrade",
                "customer.subscription.updated",
                "acct_1",
                "cus_1",
                "sub_2",
                "price_cheap",
                Instant.parse("2026-09-01T00:00:00Z"),
                "active",
                true,
                true,
                true,
                Map.of("tenant_id", "7", "user_id", "3", "product_id", "11"),
                null,
                false,
                null,
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_downgrade", "customer.subscription.updated", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));
        SubscriptionProduct cheap = new SubscriptionProduct();
        cheap.setId(22L);
        cheap.setStripePriceId("price_cheap");
        when(subscriptionProductRepository.findFirstByTenantIdAndStripePriceIdOrderByIdAsc(7L, "price_cheap"))
                .thenReturn(Optional.of(cheap));
        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

        // Stale metadata says product 11 (expensive); the live price resolves to 22 (cheap).
        verify(stripeSubscriptionSyncService).upsertStripeSubscription(
                eq(7L), eq(3L), eq(22L), eq("sub_2"), eq("cus_1"),
                eq(SubscriptionStatus.ACTIVE),
                eq(Instant.parse("2026-09-01T00:00:00Z")),
                isNull()
        );
    }

    @Test
    void checkoutCompletedUnpaidStaysIncomplete() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_unpaid",
                "checkout.session.completed",
                "acct_1",
                "cus_1",
                "sub_1",
                "price_1",
                Instant.parse("2026-09-01T00:00:00Z"),
                null,
                true,
                true,
                true,
                Map.of("tenant_id", "7", "user_id", "3", "product_id", "11"),
                "pi_1",
                false,
                "unpaid",
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_unpaid", "checkout.session.completed", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(11L);
        when(subscriptionProductRepository.findByIdAndTenantId(11L, 7L)).thenReturn(Optional.of(product));

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

        verify(stripeSubscriptionSyncService).upsertStripeSubscription(
                eq(7L),
                eq(3L),
                eq(11L),
                eq("sub_1"),
                eq("cus_1"),
                eq(SubscriptionStatus.INCOMPLETE),
                eq(Instant.parse("2026-09-01T00:00:00Z")),
                eq("pi_1")
        );
    }

    @Test
    void checkoutCompletedDoesNotResurrectCanceledSubscription() {
        // #536: a paid checkout-completed (or its delayed async_payment_succeeded) used to skip
        // the canceled-row guard entirely and re-grant paid access.
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_checkout_stale",
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
                false,
                "paid",
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_checkout_stale", "checkout.session.completed", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(11L);
        when(subscriptionProductRepository.findByIdAndTenantId(11L, 7L)).thenReturn(Optional.of(product));

        Subscription canceled = new Subscription();
        canceled.setStatus(SubscriptionStatus.CANCELED);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionId(7L, "sub_1"))
                .thenReturn(Optional.of(canceled));
        when(stripeOperations.retrieveSubscriptionStatus("acct_1", "sub_1")).thenReturn("canceled");

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

        verify(stripeSubscriptionSyncService, never()).upsertStripeSubscription(
                any(), any(), any(), any(), any(), any(), any(), any()
        );
    }

    @Test
    void staleUpdatedDoesNotReactivateWhenLiveStatusIsPastDue() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_pastdue",
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
                false,
                null,
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_pastdue", "customer.subscription.updated", "acct_1"))
                .thenReturn(1);
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account(7L, "acct_1"));

        Subscription canceled = new Subscription();
        canceled.setStatus(SubscriptionStatus.CANCELED);
        when(subscriptionRepository.findByTenantIdAndExternalSubscriptionId(7L, "sub_1"))
                .thenReturn(Optional.of(canceled));
        // Live Stripe is past_due: not in good standing, so it must not re-grant entitlements.
        when(stripeOperations.retrieveSubscriptionStatus("acct_1", "sub_1")).thenReturn("past_due");

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

        verify(stripeSubscriptionSyncService, never()).upsertStripeSubscription(
                any(), any(), any(), any(), any(), any(), any(), any()
        );
    }

    @Test
    void accountUpdatedWithUndeserializedDataObjectIsIgnored() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_acct_bad",
                "account.updated",
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
                false,
                null,
                false
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_acct_bad", "account.updated", "acct_1"))
                .thenReturn(1);

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

        verify(stripeConnectService, never())
                .applyAccountUpdate(any(), anyBoolean(), anyBoolean(), anyBoolean());
    }

    @Test
    void accountUpdatedAppliesDeserializedCapabilities() {
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_acct_ok",
                "account.updated",
                "acct_1",
                null,
                null,
                null,
                null,
                null,
                true,
                true,
                true,
                Map.of(),
                null,
                false,
                null,
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_acct_ok", "account.updated", "acct_1"))
                .thenReturn(1);

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

        verify(stripeConnectService).applyAccountUpdate("acct_1", true, true, true);
    }

    @Test
    void checkoutCompletedCancelsOrphanWhenRebindIsRefused() {
        // #944: dual checkout race — second webhook must cancel the unbound Stripe sub and still
        // keep the event processed (do not throw / fail the job).
        StripeOperations.StripeWebhookPayload payload = new StripeOperations.StripeWebhookPayload(
                "evt_rebind",
                "checkout.session.completed",
                "acct_1",
                "cus_1",
                "sub_orphan",
                "price_1",
                Instant.parse("2026-09-01T00:00:00Z"),
                "active",
                true,
                true,
                true,
                Map.of("tenant_id", "7", "user_id", "3", "product_id", "11"),
                "pi_1",
                false,
                "paid",
                true
        );
        when(stripeOperations.parseWebhook("{}", "sig")).thenReturn(payload);
        when(processedWebhookEventRepository.insertIfAbsent("evt_rebind", "checkout.session.completed", "acct_1"))
                .thenReturn(1);
        TenantStripeAccount account = account(7L, "acct_1");
        when(stripeConnectService.findByStripeAccountId("acct_1")).thenReturn(account);
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(11L);
        when(subscriptionProductRepository.findByIdAndTenantId(11L, 7L)).thenReturn(Optional.of(product));
        when(stripeSubscriptionSyncService.upsertStripeSubscription(
                7L,
                3L,
                11L,
                "sub_orphan",
                "cus_1",
                SubscriptionStatus.ACTIVE,
                Instant.parse("2026-09-01T00:00:00Z"),
                "pi_1"
        )).thenThrow(new StripeSubscriptionRebindRefusedException(7L, 99L, "sub_old", "sub_orphan"));
        when(stripeOperations.isConfigured()).thenReturn(true);

        service.applyParsedEvent(service.parseAndValidate("{}", "sig"));

        verify(stripeOperations).cancelSubscription("acct_1", "sub_orphan");
        verify(transactionManager).commit(any());
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
