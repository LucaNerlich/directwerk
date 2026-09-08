package de.pnnit.directwerk.modules.newsletter.service;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.service.FeedTokenProtector;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterListStatus;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.newsletter.repository.NewsletterSubscriptionRepository;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NewsletterNotifyAudienceServiceTest {

    @Mock
    private ArticleRepository articleRepository;

    @Mock
    private NewsletterSubscriptionRepository subscriptionRepository;

    @Mock
    private FeedTokenProtector feedTokenProtector;

    private NewsletterNotifyAudienceService service;

    @BeforeEach
    void setUp() {
        service = new NewsletterNotifyAudienceService(articleRepository, subscriptionRepository, feedTokenProtector);
    }

    @Test
    void queriesSubscriptionsOnlyForActiveAttachedLists() {
        NewsletterList active = newsletterList(1L, NewsletterListStatus.ACTIVE);
        NewsletterList archived = newsletterList(2L, NewsletterListStatus.ARCHIVED);
        Article article = new Article();
        article.getNewsletterLists().addAll(List.of(active, archived));
        when(articleRepository.findByIdAndTenantId(7L, 10L)).thenReturn(Optional.of(article));
        when(subscriptionRepository.findActiveByTenantIdAndListIdIn(10L, Set.of(1L))).thenReturn(List.of());

        service.findActiveRecipientsForArticle(10L, 7L);

        verify(subscriptionRepository).findActiveByTenantIdAndListIdIn(10L, Set.of(1L));
    }

    private static NewsletterList newsletterList(Long id, NewsletterListStatus status) {
        NewsletterList list = new NewsletterList();
        list.setId(id);
        list.setStatus(status);
        return list;
    }
}
