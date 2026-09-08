package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.content.NewsletterNotifyAudienceApi;
import de.pnnit.directwerk.modules.core.service.FeedTokenProtector;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterListStatus;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscription;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.newsletter.repository.NewsletterSubscriptionRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NewsletterNotifyAudienceService implements NewsletterNotifyAudienceApi {

    private final ArticleRepository articleRepository;
    private final NewsletterSubscriptionRepository subscriptionRepository;
    private final FeedTokenProtector feedTokenProtector;

    @Override
    @Transactional(readOnly = true)
    public List<Recipient> findActiveRecipientsForArticle(Long tenantId, Long articleId) {
        return articleRepository.findByIdAndTenantId(articleId, tenantId)
                .map(article -> {
                    Set<Long> listIds = article.getNewsletterLists().stream()
                            .filter(list -> list.getStatus() == NewsletterListStatus.ACTIVE)
                            .map(NewsletterList::getId)
                            .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
                    if (listIds.isEmpty()) {
                        return List.<Recipient>of();
                    }
                    List<NewsletterSubscription> rows = subscriptionRepository.findActiveByTenantIdAndListIdIn(tenantId, listIds);
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
}
