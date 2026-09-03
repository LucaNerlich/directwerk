package de.pnnit.directwerk.modules.stripebilling;

import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.stripebilling.entity.TenantStripeAccount;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeSignatureException;
import de.pnnit.directwerk.modules.stripebilling.repository.ProcessedWebhookEventRepository;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionProductRepository;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import de.pnnit.directwerk.modules.stripebilling.service.StripeSubscriptionSyncService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StripeWebhookService {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookService.class);

    private final StripeOperations stripeOperations;
    private final StripeConnectService stripeConnectService;
    private final StripeSubscriptionSyncService stripeSubscriptionSyncService;
    private final SubscriptionProductRepository subscriptionProductRepository;
    private final ProcessedWebhookEventRepository processedWebhookEventRepository;
    private final SubscriptionRepository subscriptionRepository;

    public StripeWebhookService(
            StripeOperations stripeOperations,
            StripeConnectService stripeConnectService,
            StripeSubscriptionSyncService stripeSubscriptionSyncService,
            SubscriptionProductRepository subscriptionProductRepository,
            ProcessedWebhookEventRepository processedWebhookEventRepository,
            SubscriptionRepository subscriptionRepository
    ) {
        this.stripeOperations = stripeOperations;
        this.stripeConnectService = stripeConnectService;
        this.stripeSubscriptionSyncService = stripeSubscriptionSyncService;
        this.subscriptionProductRepository = subscriptionProductRepository;
        this.processedWebhookEventRepository = processedWebhookEventRepository;
        this.subscriptionRepository = subscriptionRepository;
    }

    public StripeOperations.StripeWebhookPayload parseAndValidate(String payload, String signature) {
        if (signature == null || signature.isBlank()) {
            throw new StripeSignatureException("Stripe-Signature header is required");
        }
        return stripeOperations.parseWebhook(payload, signature);
    }

    @Transactional
    public void handle(String payload, String signature) {
        applyParsedEvent(parseAndValidate(payload, signature));
    }

    /**
     * Applies a signature-verified webhook event. Idempotent via {@code processed_webhook_events}.
     * Used by the HTTP controller (inline when the queue is off) and {@code StripeWebhookJobHandler}.
     */
    @Transactional
    public void applyParsedEvent(StripeOperations.StripeWebhookPayload event) {
        // Insert-first idempotency: the unique event_id constraint is enforced before any money
        // side effects, so a concurrent duplicate (Stripe retry after a timed-out first response)
        // aborts here instead of double-applying the event.
        if (processedWebhookEventRepository.insertIfAbsent(
                event.eventId(),
                event.type(),
                event.connectedAccountId()) == 0) {
            return;
        }
        Long previousTenantId = TenantContext.getTenantId();
        try {
            applyEvent(event);
        } finally {
            if (previousTenantId == null) {
                TenantContext.clear();
            } else {
                TenantContext.setTenantId(previousTenantId);
            }
        }
    }

    private void applyEvent(StripeOperations.StripeWebhookPayload event) {
        if ("account.updated".equals(event.type())) {
            if (event.connectedAccountId() != null) {
                stripeConnectService.applyAccountUpdate(
                        event.connectedAccountId(),
                        event.chargesEnabled(),
                        event.payoutsEnabled(),
                        event.detailsSubmitted()
                );
            }
            return;
        }

        TenantStripeAccount account = resolveAccount(event);
        if (account == null) {
            log.warn("Ignoring Stripe event type={} without a mapped Connect account", event.type());
            return;
        }
        Long tenantId = account.getTenant().getId();
        TenantContext.setTenantId(tenantId);
        if (!metadataTenantMatches(event, tenantId)) {
            log.warn("Ignoring Stripe event type={} event={} with mismatched tenant metadata",
                    event.type(), event.eventId());
            return;
        }

        switch (event.type()) {
            case "checkout.session.completed" -> applyCheckoutCompleted(tenantId, event);
            case "customer.subscription.updated" -> applySubscriptionSync(tenantId, event);
            case "invoice.paid" -> applyInvoicePaid(tenantId, event);
            case "customer.subscription.deleted" -> applySubscriptionCanceled(tenantId, event);
            case "invoice.payment_failed" -> applyPaymentFailed(tenantId, event);
            case "charge.refunded" -> applyChargeRefunded(tenantId, event);
            default -> log.info("Ignoring unhandled Stripe event type={}", event.type());
        }
    }

    private TenantStripeAccount resolveAccount(StripeOperations.StripeWebhookPayload event) {
        if (event.connectedAccountId() == null || event.connectedAccountId().isBlank()) {
            return null;
        }
        return stripeConnectService.findByStripeAccountId(event.connectedAccountId());
    }

    private void applyCheckoutCompleted(Long tenantId, StripeOperations.StripeWebhookPayload event) {
        Long userId = parseLong(event.metadata().get("user_id"));
        Long productId = parseLong(event.metadata().get("product_id"));
        if (userId == null || productId == null) {
            log.warn("Ignoring checkout.session.completed without tenant metadata");
            return;
        }
        SubscriptionProduct product = subscriptionProductRepository.findByIdAndTenantId(productId, tenantId)
                .orElse(null);
        if (product == null) {
            log.warn("Ignoring checkout.session.completed for unknown product");
            return;
        }
        // A completed checkout means payment succeeded; the session does not carry a
        // subscription status, so default to ACTIVE rather than mapping a null status.
        SubscriptionStatus status =
                event.stripeSubscriptionStatus() == null || event.stripeSubscriptionStatus().isBlank()
                        ? SubscriptionStatus.ACTIVE
                        : mapStripeStatus(event.stripeSubscriptionStatus());
        if (event.subscriptionId() == null || event.subscriptionId().isBlank()) {
            status = SubscriptionStatus.ACTIVE;
        }
        stripeSubscriptionSyncService.upsertStripeSubscription(
                tenantId,
                userId,
                productId,
                event.subscriptionId(),
                event.customerId(),
                status,
                event.currentPeriodEnd(),
                event.paymentIntentId()
        );
    }

    private void applySubscriptionSync(Long tenantId, StripeOperations.StripeWebhookPayload event) {
        if (event.subscriptionId() == null || event.subscriptionId().isBlank()) {
            return;
        }
        Long userId = parseLong(event.metadata().get("user_id"));
        Long productId = parseLong(event.metadata().get("product_id"));
        if (event.stripePriceId() != null) {
            // Prefer the live Stripe price over checkout-time metadata: plan changes via the
            // customer portal or dashboard keep stale metadata on the subscription object, and
            // trusting it would over-grant after a downgrade. Unknown prices fall back to
            // metadata (or to external-id sync when metadata is absent).
            Long priceProductId = findProductIdByStripePrice(tenantId, event.stripePriceId());
            if (priceProductId != null) {
                if (productId != null && !productId.equals(priceProductId)) {
                    log.info("Subscription {} price maps to product {} (metadata product {} superseded)",
                            event.subscriptionId(), priceProductId, productId);
                }
                productId = priceProductId;
            }
        }
        SubscriptionStatus mappedStatus = mapStripeStatus(event.stripeSubscriptionStatus());
        if (userId == null || productId == null) {
            if (mappedStatus == SubscriptionStatus.ACTIVE
                    && hasLocalCanceledRow(tenantId, event.subscriptionId())) {
                if (!isLiveActive(tenantId, event)) {
                    log.warn(
                            "Skipping stale sync for canceled local row (subscription={})",
                            event.subscriptionId());
                    return;
                }
            }
            stripeSubscriptionSyncService.syncStripeSubscriptionByExternalId(
                    tenantId,
                    event.subscriptionId(),
                    mappedStatus,
                    event.currentPeriodEnd()
            );
            return;
        }
        // Guard against out-of-order delivery: a stale/retried `updated` event
        // arriving after `deleted` must not resurrect paid entitlements. When
        // the local row is CANCELED, only apply ACTIVE if the subscription is
        // verifiably active at Stripe right now.
        if (mappedStatus == SubscriptionStatus.ACTIVE && hasLocalCanceledRow(tenantId, event.subscriptionId())) {
            if (!isLiveActive(tenantId, event)) {
                log.warn(
                        "Skipping stale subscription.updated for canceled local row (subscription={})",
                        event.subscriptionId());
                return;
            }
        }
        stripeSubscriptionSyncService.upsertStripeSubscription(
                tenantId,
                userId,
                productId,
                event.subscriptionId(),
                event.customerId(),
                mappedStatus,
                event.currentPeriodEnd(),
                event.paymentIntentId()
        );
    }

    private void applySubscriptionCanceled(Long tenantId, StripeOperations.StripeWebhookPayload event) {
        if (event.subscriptionId() == null) {
            return;
        }
        stripeSubscriptionSyncService.syncStripeSubscriptionByExternalId(
                tenantId,
                event.subscriptionId(),
                SubscriptionStatus.CANCELED,
                event.currentPeriodEnd()
        );
    }

    private void applyInvoicePaid(Long tenantId, StripeOperations.StripeWebhookPayload event) {
        if (event.subscriptionId() == null || event.subscriptionId().isBlank()) {
            return;
        }
        // An invoice.paid event confirms a payment; it must not force ACTIVE or wipe the stored
        // period end. Only subscriptions that were overdue/incomplete are moved back to ACTIVE.
        stripeSubscriptionSyncService.markInvoicePaid(tenantId, event.subscriptionId());
    }

    private void applyChargeRefunded(Long tenantId, StripeOperations.StripeWebhookPayload event) {
        if (!event.fullyRefunded()) {
            return;
        }
        stripeSubscriptionSyncService.cancelStripeOneTimeByPaymentId(tenantId, event.paymentIntentId());
    }

    private void applyPaymentFailed(Long tenantId, StripeOperations.StripeWebhookPayload event) {
        if (event.subscriptionId() == null) {
            return;
        }
        stripeSubscriptionSyncService.syncStripeSubscriptionByExternalId(
                tenantId,
                event.subscriptionId(),
                SubscriptionStatus.PAST_DUE,
                event.currentPeriodEnd()
        );
    }

    private Long findProductIdByStripePrice(Long tenantId, String stripePriceId) {
        return subscriptionProductRepository.findByTenantIdOrderBySortOrderAscIdAsc(tenantId).stream()
                .filter(product -> stripePriceId.equals(product.getStripePriceId()))
                .map(SubscriptionProduct::getId)
                .findFirst()
                .orElse(null);
    }

    private boolean hasLocalCanceledRow(Long tenantId, String externalSubscriptionId) {
        return subscriptionRepository
                .findByTenantIdAndExternalSubscriptionId(tenantId, externalSubscriptionId)
                .map(subscription -> subscription.getStatus() == SubscriptionStatus.CANCELED)
                .orElse(false);
    }

    private boolean isLiveActive(Long tenantId, StripeOperations.StripeWebhookPayload event) {
        try {
            String liveStatus = stripeOperations.retrieveSubscriptionStatus(
                    event.connectedAccountId(),
                    event.subscriptionId());
            return "active".equals(liveStatus)
                    || "trialing".equals(liveStatus)
                    || "past_due".equals(liveStatus);
        } catch (RuntimeException ex) {
            log.warn(
                    "Live subscription lookup failed for canceled local row (subscription={}) — refusing reactivation",
                    event.subscriptionId(),
                    ex);
            // Fail closed: without live confirmation, do not reactivate.
            return false;
        }
    }

    private static boolean metadataTenantMatches(
            StripeOperations.StripeWebhookPayload event,
            Long tenantId
    ) {
        String metadataTenantId = event.metadata().get("tenant_id");
        if (metadataTenantId == null || metadataTenantId.isBlank()) {
            return true;
        }
        try {
            return tenantId.equals(Long.valueOf(metadataTenantId.trim()));
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    private static SubscriptionStatus mapStripeStatus(String stripeStatus) {
        if (stripeStatus == null || stripeStatus.isBlank()) {
            return SubscriptionStatus.PAST_DUE;
        }
        return switch (stripeStatus) {
            case "active", "trialing" -> SubscriptionStatus.ACTIVE;
            case "past_due", "unpaid", "paused" -> SubscriptionStatus.PAST_DUE;
            case "incomplete", "incomplete_expired" -> SubscriptionStatus.INCOMPLETE;
            case "canceled" -> SubscriptionStatus.CANCELED;
            // Fail closed: unknown statuses never grant entitlements.
            default -> SubscriptionStatus.PAST_DUE;
        };
    }

    private static Long parseLong(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
