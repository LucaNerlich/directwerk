package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.content.ContentPublishedEvent;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.content.NewsletterNotificationApi;
import de.pnnit.directwerk.modules.core.service.FeedTokenProtector;
import de.pnnit.directwerk.modules.core.util.PublicContentUrlResolver;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.email.content.TenantContentBrandingResolver;
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
    private final NewsletterSubscriptionRepository subscriptionRepository;
    private final FeedTokenProtector feedTokenProtector;
    private final PublicContentUrlResolver publicContentUrlResolver;
    private final TenantContentBrandingResolver tenantContentBrandingResolver;
    private final EmailJobProducer emailJobProducer;

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
            String unsubscribeUrl = publicContentUrlResolver.newsletterUnsubscribeUrl(
                    tenantId,
                    recipient.rawUnsubscribeToken()
            );
            emailJobProducer.enqueueContentNotification(
                    tenantId,
                    recipient.email(),
                    EmailTemplate.CONTENT_ARTICLE_PUBLISHED,
                    variables(event, branding, contentUrl, unsubscribeUrl),
                    correlationId(event.contentId(), recipient.email())
            );
        }
    }

    /**
     * ACTIVE subscriptions on the article's ACTIVE lists, deduped by email.
     * The unsubscribe token of any one subscription is enough — unsubscribing
     * removes the address from every list in the tenant.
     */
    private List<Recipient> resolveRecipients(Long tenantId, Long articleId) {
        return articleRepository.findByIdAndTenantId(articleId, tenantId)
                .map(article -> {
                    Set<Long> listIds = article.getNewsletterLists().stream()
                            .filter(list -> list.getStatus() == NewsletterListStatus.ACTIVE)
                            .map(NewsletterList::getId)
                            .collect(Collectors.toCollection(LinkedHashSet::new));
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

    private static Map<String, String> variables(
            ContentPublishedEvent event,
            TenantContentBrandingResolver.BrandingContext branding,
            String contentUrl,
            String unsubscribeUrl
    ) {
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("recipientName", "there");
        variables.put("tenantName", branding.tenantName());
        variables.put("siteTitle", branding.siteTitle());
        variables.put("title", event.title());
        variables.put("excerpt", event.excerpt() == null ? "" : event.excerpt());
        variables.put("contentUrl", contentUrl);
        variables.put("unsubscribeUrl", unsubscribeUrl);
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
