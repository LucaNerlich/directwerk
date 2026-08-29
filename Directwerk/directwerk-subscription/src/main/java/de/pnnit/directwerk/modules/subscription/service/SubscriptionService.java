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
import de.pnnit.directwerk.modules.subscription.billing.ExternalSubscriptionBillingGateway;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.event.SubscriptionMembershipActivatedEvent;
import de.pnnit.directwerk.modules.subscription.exception.SubscriptionNotFoundException;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
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
    private final ObjectProvider<ExternalSubscriptionBillingGateway> externalBillingGateway;

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
            throw new IllegalArgumentException(
                    "User already has an active Stripe subscription for this product; revoke it before granting manual access");
        }
        if (existing != null) {
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
        eventPublisher.publishEvent(new SubscriptionMembershipActivatedEvent(tenantId, user.getId()));
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

    @Transactional
    public Subscription revokeSubscription(Long tenantId, Long subscriptionId) {
        Subscription subscription = subscriptionRepository.findByIdAndTenantId(subscriptionId, tenantId)
                .orElseThrow(() -> new SubscriptionNotFoundException(subscriptionId));
        externalBillingGateway.ifAvailable(
                gateway -> gateway.cancelExternalSubscriptionIfNeeded(tenantId, subscription)
        );
        subscription.setStatus(SubscriptionStatus.CANCELED);
        subscriptionRepository.save(subscription);
        eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
        return subscriptionRepository.findDetailedByIdAndTenantId(subscriptionId, tenantId)
                .orElse(subscription);
    }

    private String normalizeEmail(String email) {
        String normalized = EmailNormalizer.normalize(email);
        if (!normalized.contains("@") || normalized.startsWith("@") || normalized.endsWith("@")) {
            throw new IllegalArgumentException("Email format is invalid");
        }
        return normalized;
    }
}
