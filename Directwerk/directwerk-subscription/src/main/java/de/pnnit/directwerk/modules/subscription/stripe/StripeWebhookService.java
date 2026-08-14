package de.pnnit.directwerk.modules.subscription.stripe;

import de.pnnit.directwerk.modules.subscription.entity.ProcessedWebhookEvent;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.entity.TenantStripeAccount;
import de.pnnit.directwerk.modules.subscription.exception.StripeSignatureException;
import de.pnnit.directwerk.modules.subscription.repository.ProcessedWebhookEventRepository;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionProductRepository;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StripeWebhookService {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookService.class);

    private final StripeOperations stripeOperations;
    private final StripeConnectService stripeConnectService;
    private final SubscriptionService subscriptionService;
    private final SubscriptionProductRepository subscriptionProductRepository;
    private final ProcessedWebhookEventRepository processedWebhookEventRepository;
    private final ApplicationEventPublisher eventPublisher;

    public StripeWebhookService(
            StripeOperations stripeOperations,
            StripeConnectService stripeConnectService,
            SubscriptionService subscriptionService,
            SubscriptionProductRepository subscriptionProductRepository,
            ProcessedWebhookEventRepository processedWebhookEventRepository,
            ApplicationEventPublisher eventPublisher
    ) {
        this.stripeOperations = stripeOperations;
        this.stripeConnectService = stripeConnectService;
        this.subscriptionService = subscriptionService;
        this.subscriptionProductRepository = subscriptionProductRepository;
        this.processedWebhookEventRepository = processedWebhookEventRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public void handle(String payload, String signature) {
        if (signature == null || signature.isBlank()) {
            throw new StripeSignatureException("Stripe-Signature header is required");
        }
        StripeOperations.StripeWebhookPayload event = stripeOperations.parseWebhook(payload, signature);
        if (processedWebhookEventRepository.existsByEventId(event.eventId())) {
            return;
        }
        Long previousTenantId = TenantContext.getTenantId();
        try {
            applyEvent(event);
            ProcessedWebhookEvent processed = new ProcessedWebhookEvent();
            processed.setEventId(event.eventId());
            processed.setEventType(event.type());
            processed.setStripeAccountId(event.connectedAccountId());
            processed.setProcessedAt(Instant.now());
            processedWebhookEventRepository.save(processed);
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

        switch (event.type()) {
            case "checkout.session.completed" -> applyCheckoutCompleted(tenantId, event);
            case "customer.subscription.updated", "invoice.paid" -> applySubscriptionSync(tenantId, event);
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
        SubscriptionStatus status = mapStripeStatus(event.stripeSubscriptionStatus());
        if (event.subscriptionId() == null || event.subscriptionId().isBlank()) {
            status = SubscriptionStatus.ACTIVE;
        }
        subscriptionService.upsertStripeSubscription(
                tenantId,
                userId,
                productId,
                event.subscriptionId(),
                event.customerId(),
                status,
                event.currentPeriodEnd(),
                event.paymentIntentId()
        );
        if (status == SubscriptionStatus.ACTIVE) {
            eventPublisher.publishEvent(new StripeMembershipActivatedEvent(tenantId, userId));
        }
    }

    private void applySubscriptionSync(Long tenantId, StripeOperations.StripeWebhookPayload event) {
        if (event.subscriptionId() == null || event.subscriptionId().isBlank()) {
            return;
        }
        Long userId = parseLong(event.metadata().get("user_id"));
        Long productId = parseLong(event.metadata().get("product_id"));
        if (productId == null && event.stripePriceId() != null) {
            productId = findProductIdByStripePrice(tenantId, event.stripePriceId());
        }
        if (userId == null || productId == null) {
            subscriptionService.syncStripeSubscriptionByExternalId(
                    tenantId,
                    event.subscriptionId(),
                    mapStripeStatus(event.stripeSubscriptionStatus()),
                    event.currentPeriodEnd()
            );
            return;
        }
        subscriptionService.upsertStripeSubscription(
                tenantId,
                userId,
                productId,
                event.subscriptionId(),
                event.customerId(),
                mapStripeStatus(event.stripeSubscriptionStatus()),
                event.currentPeriodEnd(),
                event.paymentIntentId()
        );
    }

    private void applySubscriptionCanceled(Long tenantId, StripeOperations.StripeWebhookPayload event) {
        if (event.subscriptionId() == null) {
            return;
        }
        subscriptionService.syncStripeSubscriptionByExternalId(
                tenantId,
                event.subscriptionId(),
                SubscriptionStatus.CANCELED,
                event.currentPeriodEnd()
        );
    }

    private void applyChargeRefunded(Long tenantId, StripeOperations.StripeWebhookPayload event) {
        if (!event.fullyRefunded()) {
            return;
        }
        subscriptionService.cancelStripeOneTimeByPaymentId(tenantId, event.paymentIntentId());
    }

    private void applyPaymentFailed(Long tenantId, StripeOperations.StripeWebhookPayload event) {
        if (event.subscriptionId() == null) {
            return;
        }
        subscriptionService.syncStripeSubscriptionByExternalId(
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

    private static SubscriptionStatus mapStripeStatus(String stripeStatus) {
        if (stripeStatus == null || stripeStatus.isBlank()) {
            return SubscriptionStatus.ACTIVE;
        }
        return switch (stripeStatus) {
            case "active", "trialing" -> SubscriptionStatus.ACTIVE;
            case "past_due", "unpaid" -> SubscriptionStatus.PAST_DUE;
            case "incomplete", "incomplete_expired" -> SubscriptionStatus.INCOMPLETE;
            case "canceled" -> SubscriptionStatus.CANCELED;
            default -> SubscriptionStatus.ACTIVE;
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
