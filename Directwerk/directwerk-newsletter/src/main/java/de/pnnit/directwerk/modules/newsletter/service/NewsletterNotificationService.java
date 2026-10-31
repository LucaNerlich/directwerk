package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.content.ContentPublishedEvent;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.content.NewsletterNotificationApi;
import de.pnnit.directwerk.modules.core.service.FeedTokenProtector;
import de.pnnit.directwerk.modules.core.util.PublicContentUrlResolver;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import de.pnnit.directwerk.modules.email.repository.ContentNotificationMarkerRepository;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.email.content.TenantContentBrandingResolver;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterListStatus;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscription;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.newsletter.repository.NewsletterSubscriptionRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deep module for article-newsletter delivery.
 *
 * <p>Owns recipient resolution (active lists, deduped by email), unsubscribe
 * scope, unsubscribe URL construction and the email enqueue. Publication code
 * and the queue handler only hand over the {@link ContentPublishedEvent}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NewsletterNotificationService implements NewsletterNotificationApi {

    private final ArticleRepository articleRepository;
    private final NewsletterListService newsletterListService;
    private final NewsletterSubscriptionRepository subscriptionRepository;
    private final FeedTokenProtector feedTokenProtector;
    private final PublicContentUrlResolver publicContentUrlResolver;
    private final TenantContentBrandingResolver tenantContentBrandingResolver;
    private final EmailJobProducer emailJobProducer;
    private final ContentNotificationMarkerRepository contentNotificationMarkerRepository;

    @Override
    @Transactional(readOnly = true)
    public long countArticleRecipients(Long tenantId, Long articleId) {
        // Preview only needs a deduped count — do not decrypt unsubscribe tokens.
        return articleRepository.findByIdAndTenantId(articleId, tenantId)
                .map(article -> {
                    Set<Long> listIds = activeEffectiveListIds(tenantId, article);
                    if (listIds.isEmpty()) {
                        return 0L;
                    }
                    return subscriptionRepository.findActiveByTenantIdAndListIdIn(tenantId, listIds).stream()
                            .map(NewsletterSubscription::getEmail)
                            .distinct()
                            .count();
                })
                .orElse(0L);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasActiveArticleAudience(Long tenantId, Long articleId) {
        return articleRepository.findByIdAndTenantId(articleId, tenantId)
                .map(article -> !activeEffectiveListIds(tenantId, article).isEmpty())
                .orElse(false);
    }

    @Override
    @Transactional
    public void notifyArticlePublished(ContentPublishedEvent event) {
        Long tenantId = event.tenantId();
        List<Recipient> recipients = resolveRecipients(tenantId, event.contentId());
        if (recipients.isEmpty()) {
            log.debug("No newsletter recipients for tenant={} article={}", tenantId, event.contentId());
            return;
        }
        TenantContentBrandingResolver.BrandingContext branding = tenantContentBrandingResolver.resolve(tenantId);
        String contentUrl = publicContentUrlResolver.contentPageUrl(tenantId, ContentType.ARTICLE, event.slug());
        for (Recipient recipient : recipients) {
            // Issue #539: a retried CONTENT_NOTIFY job re-runs this fan-out. Claim each address
            // once so a lease takeover cannot enqueue a second campaign to the same recipient.
            if (!contentNotificationMarkerRepository.claimNewsletterRecipient(
                    tenantId, event.contentId(), recipient.email())) {
                continue;
            }
            // Issue #323: the raw unsubscribe token is a capability. Pass it through the queue's
            // protected-token channel (protectForQueue) and let the handler build the URL, instead
            // of persisting the full unsubscribe URL — and with it the raw token — in cleartext in
            // the job payload.
            emailJobProducer.enqueueTokenizedContentNotification(
                    tenantId,
                    recipient.email(),
                    EmailTemplate.NEWSLETTER_ARTICLE_PUBLISHED,
                    variables(event, branding, contentUrl),
                    recipient.rawUnsubscribeToken(),
                    correlationId(event.contentId(), recipient.email())
            );
        }
    }

    /**
     * ACTIVE subscriptions on the article's effective ACTIVE lists (draft overlay when
     * present), deduped by email. The unsubscribe token of any one subscription is enough —
     * unsubscribing removes the address from every list in the tenant.
     */
    private List<Recipient> resolveRecipients(Long tenantId, Long articleId) {
        return articleRepository.findByIdAndTenantId(articleId, tenantId)
                .map(article -> {
                    Set<Long> listIds = activeEffectiveListIds(tenantId, article);
                    if (listIds.isEmpty()) {
                        return List.<Recipient>of();
                    }
                    List<NewsletterSubscription> rows =
                            subscriptionRepository.findActiveByTenantIdAndListIdIn(tenantId, listIds);
                    Map<String, Recipient> byEmail = new LinkedHashMap<>();
                    for (NewsletterSubscription row : rows) {
                        byEmail.putIfAbsent(
                                row.getEmail(),
                                new Recipient(row.getEmail(), feedTokenProtector.reveal(row.getUnsubscribeTokenProtected()))
                        );
                    }
                    return new ArrayList<>(byEmail.values());
                })
                .orElse(List.of());
    }

    /**
     * ACTIVE list ids from the draft-overlaid set Studio shows, falling back to live joins.
     * Unknown or non-ACTIVE draft ids are skipped (same fail-soft as live ARCHIVED filters).
     */
    private Set<Long> activeEffectiveListIds(Long tenantId, Article article) {
        Set<Long> effectiveIds = ArticleNewsletterAudience.effectiveListIds(article);
        if (effectiveIds.isEmpty()) {
            return Set.of();
        }
        if (!ArticleNewsletterAudience.hasDraftListOverlay(article)) {
            return article.getNewsletterLists().stream()
                    .filter(list -> list.getStatus() == NewsletterListStatus.ACTIVE)
                    .map(NewsletterList::getId)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
        }
        Set<Long> active = new LinkedHashSet<>();
        for (Long listId : effectiveIds) {
            newsletterListService.findList(tenantId, listId)
                    .filter(list -> list.getStatus() == NewsletterListStatus.ACTIVE)
                    .ifPresent(list -> active.add(list.getId()));
        }
        return active;
    }

    private static Map<String, String> variables(
            ContentPublishedEvent event,
            TenantContentBrandingResolver.BrandingContext branding,
            String contentUrl
    ) {
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("recipientName", "there");
        variables.put("tenantName", branding.tenantName());
        variables.put("siteTitle", branding.siteTitle());
        variables.put("title", event.title());
        variables.put("excerpt", event.excerpt() == null ? "" : event.excerpt());
        variables.put("contentUrl", contentUrl);
        // unsubscribeUrl is injected at delivery from the protected token (issue #323).
        variables.put("primaryColor", branding.primaryColor());
        return variables;
    }

    private static String correlationId(Long articleId, String email) {
        String emailDigest;
        try {
            byte[] normalizedEmail = email.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
            emailDigest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(normalizedEmail));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
        return "content-notify-article-%d-email-%s".formatted(
                articleId,
                emailDigest
        );
    }

    private record Recipient(String email, String rawUnsubscribeToken) {
    }
}
