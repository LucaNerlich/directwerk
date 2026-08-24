package de.pnnit.directwerk.modules.subscription.service;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.exception.SubscriptionNotFoundException;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@RequiresModule(SubscriptionModule.MODULE_KEY)
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final SubscriptionProductService subscriptionProductService;
    private final UserRepository userRepository;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final TenantRepository tenantRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<Subscription> listSubscriptionsForUser(Long tenantId, Long userId) {
        return subscriptionRepository.findByTenantIdAndUserId(tenantId, userId);
    }

    @Transactional(readOnly = true)
    public List<Subscription> listSubscriptionsForTenant(Long tenantId) {
        return subscriptionRepository.findDetailedByTenantId(tenantId);
    }

    @Transactional
    public Subscription grantManualSubscription(Long tenantId, String email, Long productId) {
        String normalizedEmail = normalizeEmail(email);
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found for tenant: " + normalizedEmail));

        TenantMembership membership = tenantMembershipRepository.findByUserIdAndTenantId(user.getId(), tenantId)
                .orElseThrow(() -> new IllegalArgumentException("User is not a member of this tenant"));
        if (membership.getStatus() != MembershipStatus.ACTIVE) {
            throw new IllegalArgumentException("User membership is not active");
        }

        SubscriptionProduct product = subscriptionProductService.requireProduct(tenantId, productId);
        if (!product.isActive()) {
            throw new IllegalArgumentException("Subscription product is not active");
        }

        Subscription existing = subscriptionRepository
                .findByTenantIdAndUserIdAndProductId(tenantId, user.getId(), productId)
                .orElse(null);
        if (existing != null && existing.getSource() == SubscriptionSource.STRIPE
                && existing.getStatus() == SubscriptionStatus.ACTIVE) {
            // (tenant, user, product) is unique: converting the row to MANUAL would keep it
            // reachable via its external IDs and later Stripe lifecycle events would cancel
            // or overwrite the admin's grant. Force an explicit revoke first.
            throw new IllegalArgumentException(
                    "User already has an active Stripe subscription for this product; revoke it before granting manual access");
        }
        if (existing != null) {
            // Drop external references so Stripe syncs that match by external ID stop
            // touching this now manually-managed row.
            existing.setExternalSubscriptionId(null);
            existing.setExternalPaymentId(null);
        }

        Subscription subscription = existing != null
                ? existing
                : newManualSubscription(tenantId, user, product);

        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setStartedAt(Instant.now());
        subscription.setEndsAt(null);
        subscription.setSource(SubscriptionSource.MANUAL);
        subscription = subscriptionRepository.save(subscription);
        eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
        return subscriptionRepository.findDetailedByIdAndTenantId(subscription.getId(), tenantId)
                .orElse(subscription);
    }

    private Subscription newManualSubscription(Long tenantId, User user, SubscriptionProduct product) {
        Subscription created = new Subscription();
        created.setTenant(tenantRepository.getReferenceById(tenantId));
        created.setUser(user);
        created.setProduct(product);
        created.setSource(SubscriptionSource.MANUAL);
        return created;
    }

    private Subscription newSubscription(Long tenantId, User user, SubscriptionProduct product) {
        Subscription created = new Subscription();
        created.setTenant(tenantRepository.getReferenceById(tenantId));
        created.setUser(user);
        created.setProduct(product);
        return created;
    }

    @Transactional
    public Subscription revokeSubscription(Long tenantId, Long subscriptionId) {
        Subscription subscription = subscriptionRepository.findByIdAndTenantId(subscriptionId, tenantId)
                .orElseThrow(() -> new SubscriptionNotFoundException(subscriptionId));
        subscription.setStatus(SubscriptionStatus.CANCELED);
        subscriptionRepository.save(subscription);
        eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
        return subscriptionRepository.findDetailedByIdAndTenantId(subscriptionId, tenantId)
                .orElse(subscription);
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
                    .findByTenantIdAndExternalSubscriptionId(tenantId, externalSubscriptionId)
                    .orElse(null);
        }
        if (subscription == null) {
            Subscription byUserAndProduct = subscriptionRepository
                    .findByTenantIdAndUserIdAndProductId(tenantId, userId, productId)
                    .orElse(null);
            if (byUserAndProduct != null
                    && byUserAndProduct.getSource() == SubscriptionSource.MANUAL
                    && byUserAndProduct.getStatus() == SubscriptionStatus.ACTIVE) {
                // An admin's active manual grant owns this row; a Stripe event carrying
                // stale/duplicate metadata must not silently overwrite it.
                return byUserAndProduct;
            }
            subscription = byUserAndProduct != null ? byUserAndProduct : newSubscription(tenantId, userId, product);
        }
        subscription.setUser(user);
        subscription.setProduct(product);
        subscription.setSource(SubscriptionSource.STRIPE);
        subscription.setStatus(status != null ? status : SubscriptionStatus.ACTIVE);
        if (subscription.getStartedAt() == null) {
            subscription.setStartedAt(Instant.now());
        }
        if (status == SubscriptionStatus.ACTIVE && subscription.getStartedAt() == null) {
            subscription.setStartedAt(Instant.now());
        }
        subscription.setEndsAt(endsAt);
        if (externalSubscriptionId != null && !externalSubscriptionId.isBlank()) {
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
        subscriptionRepository.findByTenantIdAndExternalSubscriptionId(tenantId, externalSubscriptionId)
                .ifPresent(subscription -> {
                    subscription.setStatus(status);
                    if (endsAt != null) {
                        subscription.setEndsAt(endsAt);
                    }
                    subscriptionRepository.save(subscription);
                    eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
                });
    }

    /**
     * Confirms payment for a recurring Stripe subscription without forcing {@code ACTIVE} or
     * dropping the stored period end. Only overdue/incomplete rows are moved back to active;
     * canceled or expired rows are never reactivated by an {@code invoice.paid} delivered
     * out-of-order.
     */
    @Transactional
    public void markInvoicePaid(Long tenantId, String externalSubscriptionId) {
        if (externalSubscriptionId == null || externalSubscriptionId.isBlank()) {
            return;
        }
        subscriptionRepository.findByTenantIdAndExternalSubscriptionId(tenantId, externalSubscriptionId)
                .ifPresent(subscription -> {
                    if (subscription.getSource() != SubscriptionSource.STRIPE) {
                        return;
                    }
                    if (subscription.getStatus() != SubscriptionStatus.PAST_DUE
                            && subscription.getStatus() != SubscriptionStatus.INCOMPLETE) {
                        return;
                    }
                    subscription.setStatus(SubscriptionStatus.ACTIVE);
                    subscriptionRepository.save(subscription);
                    eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
                });
    }

    private String normalizeEmail(String email) {
        String normalized = EmailNormalizer.normalize(email);
        if (!normalized.contains("@") || normalized.startsWith("@") || normalized.endsWith("@")) {
            throw new IllegalArgumentException("Email format is invalid");
        }
        return normalized;
    }
}
