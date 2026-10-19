package de.pnnit.directwerk.modules.subscription.service;

import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.exception.SubscriptionNotFoundException;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The local half of a revocation, in its own short transaction.
 *
 * <p>{@link SubscriptionService#revokeSubscription} calls the billing provider first — a Stripe
 * HTTP call must never hold a pooled connection or a row lock (issue #547) — and then hands the
 * status write to this bean so the event listeners still run inside a transaction.</p>
 */
@Service
@RequiredArgsConstructor
public class SubscriptionRevocationWriter {

    private final SubscriptionRepository subscriptionRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public Subscription markRevoked(Long tenantId, Long subscriptionId) {
        Subscription subscription = subscriptionRepository.findByIdAndTenantId(subscriptionId, tenantId)
                .orElseThrow(() -> new SubscriptionNotFoundException(subscriptionId));
        subscription.setStatus(SubscriptionStatus.CANCELED);
        subscriptionRepository.save(subscription);
        eventPublisher.publishEvent(new TenantEntitlementsChangedEvent(tenantId));
        return subscriptionRepository.findDetailedByIdAndTenantId(subscriptionId, tenantId)
                .orElse(subscription);
    }
}
