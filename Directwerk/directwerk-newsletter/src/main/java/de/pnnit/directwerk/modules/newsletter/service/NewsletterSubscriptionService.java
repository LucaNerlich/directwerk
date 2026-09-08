package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.core.service.FeedTokenProtector;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import de.pnnit.directwerk.modules.core.util.TokenHashUtil;
import de.pnnit.directwerk.modules.email.TransactionalEmailNotifier;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscription;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscriptionStatus;
import de.pnnit.directwerk.modules.newsletter.exception.NewsletterSubscriptionNotFoundException;
import de.pnnit.directwerk.modules.newsletter.repository.NewsletterSubscriptionRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NewsletterSubscriptionService {

    private static final Duration CONFIRM_TOKEN_TTL = Duration.ofDays(7);

    private final NewsletterListService newsletterListService;
    private final NewsletterSubscriptionRepository subscriptionRepository;
    private final FeedTokenProtector feedTokenProtector;
    private final TransactionalEmailNotifier emailNotifier;

    @Transactional(readOnly = true)
    public List<NewsletterSubscription> listSubscriptions(Long tenantId, Long listId) {
        newsletterListService.requireList(tenantId, listId);
        return subscriptionRepository.findByListIdAndTenantIdOrderByCreatedAtDescIdDesc(listId, tenantId);
    }

    /**
     * Double opt-in subscribe. Always returns without revealing whether the email was new.
     */
    @Transactional
    public void requestSubscribe(Long tenantId, String listSlug, String rawEmail) {
        NewsletterList list = newsletterListService.requireActiveListBySlug(tenantId, listSlug);
        String email = EmailNormalizer.normalize(rawEmail);
        Optional<NewsletterSubscription> existing = subscriptionRepository.findByListIdAndEmail(list.getId(), email);

        NewsletterSubscription subscription;
        String confirmRaw;
        if (existing.isPresent()) {
            subscription = existing.get();
            if (subscription.getStatus() == NewsletterSubscriptionStatus.ACTIVE) {
                return;
            }
            confirmRaw = issueConfirmToken(subscription);
            issueUnsubscribeToken(subscription);
            subscription.setStatus(NewsletterSubscriptionStatus.PENDING);
            subscription.setUnsubscribedAt(null);
            subscription.setConfirmedAt(null);
        } else {
            subscription = new NewsletterSubscription();
            subscription.setTenant(list.getTenant());
            subscription.setList(list);
            subscription.setEmail(email);
            subscription.setStatus(NewsletterSubscriptionStatus.PENDING);
            confirmRaw = issueConfirmToken(subscription);
            issueUnsubscribeToken(subscription);
        }
        subscriptionRepository.save(subscription);
        emailNotifier.sendNewsletterConfirm(
                tenantId,
                email,
                list.getName(),
                confirmRaw,
                CONFIRM_TOKEN_TTL
        );
    }

    @Transactional
    public NewsletterSubscription confirm(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new NewsletterSubscriptionNotFoundException("Invalid confirm token");
        }
        NewsletterSubscription subscription = subscriptionRepository
                .findByConfirmTokenHash(TokenHashUtil.sha256Hex(rawToken.trim()))
                .orElseThrow(() -> new NewsletterSubscriptionNotFoundException("Invalid confirm token"));
        subscription.setStatus(NewsletterSubscriptionStatus.ACTIVE);
        subscription.setConfirmedAt(Instant.now());
        subscription.setConfirmTokenHash(null);
        subscription.setUnsubscribedAt(null);
        return subscriptionRepository.save(subscription);
    }

    @Transactional
    public NewsletterSubscription unsubscribe(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new NewsletterSubscriptionNotFoundException("Invalid unsubscribe token");
        }
        NewsletterSubscription subscription = subscriptionRepository
                .findByUnsubscribeTokenHash(TokenHashUtil.sha256Hex(rawToken.trim()))
                .orElseThrow(() -> new NewsletterSubscriptionNotFoundException("Invalid unsubscribe token"));
        subscription.setStatus(NewsletterSubscriptionStatus.UNSUBSCRIBED);
        subscription.setUnsubscribedAt(Instant.now());
        subscription.setConfirmTokenHash(null);
        return subscriptionRepository.save(subscription);
    }

    @Transactional
    public void adminRemove(Long tenantId, Long listId, Long subscriptionId) {
        NewsletterSubscription subscription = subscriptionRepository
                .findByIdAndTenantIdAndListId(subscriptionId, tenantId, listId)
                .orElseThrow(() -> new NewsletterSubscriptionNotFoundException(subscriptionId));
        subscription.setStatus(NewsletterSubscriptionStatus.UNSUBSCRIBED);
        subscription.setUnsubscribedAt(Instant.now());
        subscription.setConfirmTokenHash(null);
        subscriptionRepository.save(subscription);
    }

    private String issueConfirmToken(NewsletterSubscription subscription) {
        String raw;
        do {
            raw = TokenHashUtil.generateUrlSafeToken(32);
        } while (subscriptionRepository.existsByConfirmTokenHash(TokenHashUtil.sha256Hex(raw)));
        subscription.setConfirmTokenHash(TokenHashUtil.sha256Hex(raw));
        return raw;
    }

    private void issueUnsubscribeToken(NewsletterSubscription subscription) {
        String raw;
        do {
            raw = TokenHashUtil.generateUrlSafeToken(32);
        } while (subscriptionRepository.existsByUnsubscribeTokenHash(TokenHashUtil.sha256Hex(raw)));
        subscription.setUnsubscribeTokenHash(TokenHashUtil.sha256Hex(raw));
        subscription.setUnsubscribeTokenProtected(feedTokenProtector.protect(raw));
    }
}
