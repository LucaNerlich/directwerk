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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies Stripe webhook and checkout outcomes to {@link Subscription} rows. */
@Service
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
                return byUserAndProduct;
            }
            subscription = byUserAndProduct != null
                    ? byUserAndProduct
                    : newSubscription(tenantId, user, product);
        }
        SubscriptionStatus previousStatus = subscription.getStatus();
        subscription.setUser(user);
        subscription.setProduct(product);
        subscription.setSource(SubscriptionSource.STRIPE);
        subscription.setStatus(status != null ? status : SubscriptionStatus.ACTIVE);
        if (subscription.getStartedAt() == null) {
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

    private Subscription newSubscription(Long tenantId, User user, SubscriptionProduct product) {
        Subscription created = new Subscription();
        created.setTenant(tenantRepository.getReferenceById(tenantId));
        created.setUser(user);
        created.setProduct(product);
        return created;
    }
}
