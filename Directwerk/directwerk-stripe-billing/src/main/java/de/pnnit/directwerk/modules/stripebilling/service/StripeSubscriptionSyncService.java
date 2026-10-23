package de.pnnit.directwerk.modules.stripebilling.service;

import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.event.SubscriptionMembershipActivatedEvent;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionProductService;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies Stripe webhook and checkout outcomes to {@link Subscription} rows. */
@Service
@Slf4j
public class StripeSubscriptionSyncService {

    private final SubscriptionRepository subscriptionRepository;
    private final SubscriptionProductService subscriptionProductService;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final ApplicationEventPublisher eventPublisher;

    public StripeSubscriptionSyncService(
            SubscriptionRepository subscriptionRepository,
            SubscriptionProductService subscriptionProductService,
            UserRepository userRepository,
            TenantRepository tenantRepository,
            ApplicationEventPublisher eventPublisher
    ) {
        this.subscriptionRepository = subscriptionRepository;
        this.subscriptionProductService = subscriptionProductService;
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public Subscription upsertStripeSubscription(
            Long tenantId,
            Long userId,
            Long productId,
            String externalSubscriptionId,
            String stripeCustomerId,
            SubscriptionStatus status,
            Instant endsAt,
            String externalPaymentId
    ) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        SubscriptionProduct product = subscriptionProductService.requireProduct(tenantId, productId);
        Subscription subscription = null;
        if (externalSubscriptionId != null && !externalSubscriptionId.isBlank()) {
            subscription = subscriptionRepository
                    .findByTenantIdAndExternalSubscriptionIdForUpdate(tenantId, externalSubscriptionId)
                    .orElse(null);
        }
        if (subscription == null) {
            Subscription byUserAndProduct = subscriptionRepository
                    .findByTenantIdAndUserIdAndProductIdForUpdate(tenantId, userId, productId)
                    .orElse(null);
            if (byUserAndProduct != null
                    && byUserAndProduct.getSource() == SubscriptionSource.MANUAL
                    && byUserAndProduct.getStatus() == SubscriptionStatus.ACTIVE) {
                // Keep the manual grant, but record the Stripe relationship so later renewal /
                // cancellation / refund webhooks can find this row instead of no-opping.
                return recordExternalBillingOnManualGrant(
                        byUserAndProduct,
                        externalSubscriptionId,
                        stripeCustomerId,
                        externalPaymentId
                );
            }
            subscription = byUserAndProduct != null
                    ? byUserAndProduct
                    : newSubscription(tenantId, user, product);
        }
        SubscriptionStatus previousStatus = subscription.getStatus();
        SubscriptionStatus incoming = status != null ? status : SubscriptionStatus.ACTIVE;
        if (isCanceledTerminalRewrite(previousStatus, incoming)) {
            return subscription;
        }
        subscription.setUser(user);
        subscription.setProduct(product);
        subscription.setSource(SubscriptionSource.STRIPE);
        subscription.setStatus(status != null ? status : SubscriptionStatus.ACTIVE);
        if (subscription.getStartedAt() == null) {
            subscription.setStartedAt(Instant.now());
        }
        subscription.setEndsAt(endsAt);
        if (externalSubscriptionId != null && !externalSubscriptionId.isBlank()) {
            // #534: row identity is (tenant, user, product) while Stripe's is the subscription id,
            // so a second checkout used to rebind this row to the new subscription and orphan the
            // old one (still billed, no local row left to cancel it). Refuse instead of rebinding.
            String currentExternalId = subscription.getExternalSubscriptionId();
            // A CANCELED row is terminal at Stripe: the stored id is no longer billed, so a new
            // checkout for the same product may take the row over instead of paying into a void.
            boolean currentIdStillBillable = previousStatus != SubscriptionStatus.CANCELED;
            if (currentIdStillBillable
                    && currentExternalId != null
                    && !currentExternalId.isBlank()
                    && !currentExternalId.equals(externalSubscriptionId)) {
                throw new IllegalStateException(
                        "Refusing to rebind subscription " + subscription.getId()
                                + " from " + currentExternalId + " to " + externalSubscriptionId);
            }
            subscription.setExternalSubscriptionId(externalSubscriptionId);
        }
        if (stripeCustomerId != null && !stripeCustomerId.isBlank()) {
            subscription.setStripeCustomerId(stripeCustomerId);
        }
        if (externalPaymentId != null && !externalPaymentId.isBlank()) {
            subscription.setExternalPaymentId(externalPaymentId);
        }
        subscription = subscriptionRepository.save(subscription);
        eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
        if (subscription.getStatus() == SubscriptionStatus.ACTIVE
                && previousStatus != SubscriptionStatus.ACTIVE) {
            eventPublisher.publishEvent(new SubscriptionMembershipActivatedEvent(tenantId, userId));
        }
        return subscription;
    }

    @Transactional
    public void cancelStripeOneTimeByPaymentId(Long tenantId, String externalPaymentId) {
        if (externalPaymentId == null || externalPaymentId.isBlank()) {
            return;
        }
        subscriptionRepository.findByTenantIdAndExternalPaymentId(tenantId, externalPaymentId)
                .ifPresent(subscription -> {
                    if (subscription.getSource() != SubscriptionSource.STRIPE) {
                        return;
                    }
                    if (subscription.getExternalSubscriptionId() != null
                            && !subscription.getExternalSubscriptionId().isBlank()) {
                        return;
                    }
                    subscription.setStatus(SubscriptionStatus.CANCELED);
                    subscriptionRepository.save(subscription);
                    eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
                });
    }

    @Transactional
    public void syncStripeSubscriptionByExternalId(
            Long tenantId,
            String externalSubscriptionId,
            SubscriptionStatus status,
            Instant endsAt
    ) {
        subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(tenantId, externalSubscriptionId)
                .ifPresent(subscription -> {
                    if (subscription.getSource() == SubscriptionSource.MANUAL) {
                        return;
                    }
                    if (isCanceledTerminalRewrite(subscription.getStatus(), status)) {
                        return;
                    }
                    subscription.setStatus(status);
                    if (endsAt != null) {
                        subscription.setEndsAt(endsAt);
                    }
                    subscriptionRepository.save(subscription);
                    eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
                });
    }

    @Transactional
    public void markInvoicePaid(Long tenantId, String externalSubscriptionId, Instant endsAt) {
        if (externalSubscriptionId == null || externalSubscriptionId.isBlank()) {
            return;
        }
        subscriptionRepository.findByTenantIdAndExternalSubscriptionIdForUpdate(tenantId, externalSubscriptionId)
                .ifPresent(subscription -> {
                    if (subscription.getSource() != SubscriptionSource.STRIPE) {
                        return;
                    }
                    if (subscription.getStatus() != SubscriptionStatus.PAST_DUE
                            && subscription.getStatus() != SubscriptionStatus.INCOMPLETE) {
                        return;
                    }
                    subscription.setStatus(SubscriptionStatus.ACTIVE);
                    if (endsAt != null) {
                        subscription.setEndsAt(endsAt);
                    }
                    subscriptionRepository.save(subscription);
                    eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
                });
    }

    /**
     * CANCELED is terminal against non-terminal rewrites (issue #306). A delayed or retried
     * non-terminal event — {@code customer.subscription.updated} or
     * {@code invoice.payment_failed} carrying past_due/incomplete — arriving after
     * {@code customer.subscription.deleted} must not rewrite a CANCELED row: a subsequently
     * delivered stale {@code invoice.paid} would then pass {@link #markInvoicePaid}'s
     * PAST_DUE/INCOMPLETE gate and resurrect the subscription.
     * <p>
     * ACTIVE is deliberately not blocked here: a fresh checkout may legitimately re-subscribe a
     * user whose previous row was canceled (the webhook layer separately gates a stale ACTIVE
     * behind its live-Stripe check).
     */
    private boolean isCanceledTerminalRewrite(SubscriptionStatus existing, SubscriptionStatus incoming) {
        if (existing != SubscriptionStatus.CANCELED
                || (incoming != SubscriptionStatus.PAST_DUE && incoming != SubscriptionStatus.INCOMPLETE)) {
            return false;
        }
        log.warn("Ignoring non-terminal status {} for canceled subscription", incoming);
        return true;
    }

    private Subscription recordExternalBillingOnManualGrant(
            Subscription manual,
            String externalSubscriptionId,
            String stripeCustomerId,
            String externalPaymentId
    ) {
        boolean changed = false;
        if (externalSubscriptionId != null && !externalSubscriptionId.isBlank()
                && !externalSubscriptionId.equals(manual.getExternalSubscriptionId())) {
            manual.setExternalSubscriptionId(externalSubscriptionId);
            changed = true;
        }
        if (stripeCustomerId != null && !stripeCustomerId.isBlank()
                && !stripeCustomerId.equals(manual.getStripeCustomerId())) {
            manual.setStripeCustomerId(stripeCustomerId);
            changed = true;
        }
        if (externalPaymentId != null && !externalPaymentId.isBlank()
                && !externalPaymentId.equals(manual.getExternalPaymentId())) {
            manual.setExternalPaymentId(externalPaymentId);
            changed = true;
        }
        return changed ? subscriptionRepository.save(manual) : manual;
    }

    private Subscription newSubscription(Long tenantId, User user, SubscriptionProduct product) {
        Subscription created = new Subscription();
        created.setTenant(tenantRepository.getReferenceById(tenantId));
        created.setUser(user);
        created.setProduct(product);
        return created;
    }
}
