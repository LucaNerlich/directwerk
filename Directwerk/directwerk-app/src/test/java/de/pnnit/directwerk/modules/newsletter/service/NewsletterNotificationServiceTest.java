package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.ContentPublishedEvent;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.service.FeedTokenProtector;
import de.pnnit.directwerk.modules.core.util.PublicContentUrlResolver;
import de.pnnit.directwerk.modules.email.EmailJobProducer;
import de.pnnit.directwerk.modules.email.EmailTemplate;
import de.pnnit.directwerk.modules.email.content.TenantContentBrandingResolver;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterListStatus;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterSubscription;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.newsletter.repository.NewsletterSubscriptionRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NewsletterNotificationServiceTest {

    private static final Long TENANT_ID = 10L;
    private static final Long ARTICLE_ID = 7L;

    @Mock
    private ArticleRepository articleRepository;
    @Mock
    private NewsletterSubscriptionRepository subscriptionRepository;
    @Mock
    private FeedTokenProtector feedTokenProtector;
    @Mock
    private PublicContentUrlResolver publicContentUrlResolver;
    @Mock
    private TenantContentBrandingResolver tenantContentBrandingResolver;
    @Mock
    private EmailJobProducer emailJobProducer;

    private NewsletterNotificationService service;

    @BeforeEach
    void setUp() {
        service = new NewsletterNotificationService(
                articleRepository,
                subscriptionRepository,
                feedTokenProtector,
                publicContentUrlResolver,
                tenantContentBrandingResolver,
                emailJobProducer
        );
    }

    @Test
    void queriesSubscriptionsOnlyForActiveAttachedLists() {
        Article article = new Article();
        article.getNewsletterLists().addAll(List.of(
                newsletterList(1L, NewsletterListStatus.ACTIVE),
                newsletterList(2L, NewsletterListStatus.ARCHIVED)
        ));
        when(articleRepository.findByIdAndTenantId(ARTICLE_ID, TENANT_ID)).thenReturn(Optional.of(article));
        when(subscriptionRepository.findActiveByTenantIdAndListIdIn(TENANT_ID, Set.of(1L))).thenReturn(List.of());

        service.notifyArticlePublished(event());

        verify(subscriptionRepository).findActiveByTenantIdAndListIdIn(TENANT_ID, Set.of(1L));
        verify(emailJobProducer, never()).enqueueContentNotification(any(), any(), any(), any(), any());
    }

    @Test
    void enqueuesOneEmailPerUniqueAddressWithUnsubscribeUrl() {
        Article article = new Article();
        article.getNewsletterLists().addAll(List.of(
                newsletterList(1L, NewsletterListStatus.ACTIVE),
                newsletterList(2L, NewsletterListStatus.ACTIVE)
        ));
        when(articleRepository.findByIdAndTenantId(ARTICLE_ID, TENANT_ID)).thenReturn(Optional.of(article));
        when(subscriptionRepository.findActiveByTenantIdAndListIdIn(TENANT_ID, Set.of(1L, 2L))).thenReturn(List.of(
                subscription("ada@example.com", "enc-ada"),
                subscription("ada@example.com", "enc-ada-list2"),
                subscription("grace@example.com", "enc-grace")
        ));
        when(feedTokenProtector.reveal(anyString())).thenAnswer(invocation -> "raw-" + invocation.getArgument(0));
        when(tenantContentBrandingResolver.resolve(TENANT_ID))
                .thenReturn(new TenantContentBrandingResolver.BrandingContext("Acme", "Acme Magazine", "#123456"));
        when(publicContentUrlResolver.contentPageUrl(TENANT_ID, ContentType.ARTICLE, "hello-world"))
                .thenReturn("https://tenant.example/articles/hello-world");
        when(publicContentUrlResolver.newsletterUnsubscribeUrl(eq(TENANT_ID), anyString()))
                .thenAnswer(invocation -> "https://tenant.example/newsletter/unsubscribe?token=" + invocation.getArgument(1));

        service.notifyArticlePublished(event());

        ArgumentCaptor<Map<String, String>> variablesCaptor = ArgumentCaptor.forClass(Map.class);
        verify(emailJobProducer).enqueueContentNotification(
                eq(TENANT_ID), eq("ada@example.com"), eq(EmailTemplate.CONTENT_ARTICLE_PUBLISHED), variablesCaptor.capture(), any()
        );
        verify(emailJobProducer).enqueueContentNotification(
                eq(TENANT_ID), eq("grace@example.com"), eq(EmailTemplate.CONTENT_ARTICLE_PUBLISHED), any(), any()
        );
        Map<String, String> variables = variablesCaptor.getValue();
        assertThat(variables.get("title")).isEqualTo("Hello world");
        assertThat(variables.get("tenantName")).isEqualTo("Acme");
        assertThat(variables.get("siteTitle")).isEqualTo("Acme Magazine");
        assertThat(variables.get("contentUrl")).isEqualTo("https://tenant.example/articles/hello-world");
        assertThat(variables.get("unsubscribeUrl"))
                .isEqualTo("https://tenant.example/newsletter/unsubscribe?token=raw-enc-ada");
    }

    @Test
    void noActiveListsMeansNoEnqueue() {
        Article article = new Article();
        when(articleRepository.findByIdAndTenantId(ARTICLE_ID, TENANT_ID)).thenReturn(Optional.of(article));

        service.notifyArticlePublished(event());

        verify(emailJobProducer, never()).enqueueContentNotification(any(), any(), any(), any(), any());
    }

    private static ContentPublishedEvent event() {
        return new ContentPublishedEvent(
                TENANT_ID,
                ContentType.ARTICLE,
                ARTICLE_ID,
                "Hello world",
                "An excerpt",
                "hello-world",
                "FREE"
        );
    }

    private static NewsletterList newsletterList(Long id, NewsletterListStatus status) {
        NewsletterList list = new NewsletterList();
        list.setId(id);
        list.setStatus(status);
        return list;
    }

    private static NewsletterSubscription subscription(String email, String protectedToken) {
        NewsletterSubscription subscription = new NewsletterSubscription();
        subscription.setEmail(email);
        subscription.setUnsubscribeTokenProtected(protectedToken);
        return subscription;
    }
}
