package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.content.ContentPublishedEvent;
import de.pnnit.directwerk.modules.content.ContentPublishedNotifier;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleValidationException;
import de.pnnit.directwerk.modules.digital.exception.InvalidPublicationTransitionException;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import java.time.Instant;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

@ExtendWith(MockitoExtension.class)
class ArticlePublicationWorkflowServiceTest {

    @Mock
    private ArticleRepository articleRepository;

    @Mock
    private ArticleService articleService;

    @Mock
    private ModuleGateService moduleGateService;

    @Mock
    private ContentPublishedNotifier contentPublishedNotifier;

    @Mock
    private DirectwerkConfig directwerkConfig;

    private ArticlePublicationWorkflowService articlePublicationWorkflowService;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        ObjectProvider<ArticlePublicationWorkflowService> selfProvider = mock(ObjectProvider.class);
        articlePublicationWorkflowService = new ArticlePublicationWorkflowService(
                articleRepository,
                articleService,
                new de.pnnit.directwerk.modules.digital.service.HtmlSanitizer(),
                moduleGateService,
                directwerkConfig,
                contentPublishedNotifier,
                selfProvider
        );
        lenient().when(selfProvider.getObject()).thenReturn(articlePublicationWorkflowService);
        lenient().when(articleRepository.save(any(Article.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void publishDraftArticleSetsPublishedState() {
        Article article = draftArticle();
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);

        Article published = articlePublicationWorkflowService.publish(10L, 7L);

        assertThat(published.getStatus()).isEqualTo(ArticleStatus.PUBLISHED);
        assertThat(published.getPublishedAt()).isNotNull();
        assertThat(published.getBody()).contains("<p>Hello world</p>");
    }

    @Test
    void publishRequiresBody() {
        Article article = draftArticle();
        article.setBody("");
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);

        assertThatThrownBy(() -> articlePublicationWorkflowService.publish(10L, 7L))
                .isInstanceOf(ArticleValidationException.class)
                .hasMessageContaining("body");
    }

    @Test
    void publishWithNotifySubscribersEnqueuesNotificationOnFirstPublish() {
        Article article = draftArticle();
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of("EMAIL_NOTIFY"));
        when(articleRepository.claimEmailNotification(eq(10L), eq(7L), any())).thenReturn(1);

        articlePublicationWorkflowService.publish(10L, 7L, true);

        verify(contentPublishedNotifier).notifyContentPublished(new ContentPublishedEvent(
                10L,
                ContentType.ARTICLE,
                7L,
                "Hello world",
                "Hello world",
                "hello-world",
                "FREE"
        ));
    }

    @Test
    void publishWithNotifySubscribersSkipsWhenAlreadyNotified() {
        Article article = draftArticle();
        article.setEmailNotifiedAt(Instant.parse("2026-01-01T00:00:00Z"));
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);
        when(directwerkConfig.isEmailEnabled()).thenReturn(true);
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of("EMAIL_NOTIFY"));
        when(articleRepository.claimEmailNotification(eq(10L), eq(7L), any())).thenReturn(0);

        articlePublicationWorkflowService.publish(10L, 7L, true);

        verify(contentPublishedNotifier, org.mockito.Mockito.never()).notifyContentPublished(any());
    }

    @Test
    void unpublishRequiresPublishedState() {
        Article article = draftArticle();
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);

        assertThatThrownBy(() -> articlePublicationWorkflowService.unpublish(10L, 7L))
                .isInstanceOf(InvalidPublicationTransitionException.class);
    }

    @Test
    void publishScheduledArticleSkipsWhenNoLongerScheduled() {
        Article article = draftArticle();
        article.setStatus(ArticleStatus.DRAFT);
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);

        articlePublicationWorkflowService.publishScheduledArticle(10L, 7L);

        assertThat(article.getStatus()).isEqualTo(ArticleStatus.DRAFT);
        verify(articleRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void unarchiveRestoresDraftAndClearsPublishedAt() {
        Article article = draftArticle();
        article.setStatus(ArticleStatus.ARCHIVED);
        article.setPublishedAt(Instant.parse("2026-01-01T00:00:00Z"));
        article.setScheduledAt(Instant.parse("2026-01-02T00:00:00Z"));
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);

        Article restored = articlePublicationWorkflowService.unarchive(10L, 7L);

        assertThat(restored.getStatus()).isEqualTo(ArticleStatus.DRAFT);
        assertThat(restored.getPublishedAt()).isNull();
        assertThat(restored.getScheduledAt()).isNull();
    }

    @Test
    void unarchiveRequiresArchivedState() {
        Article article = draftArticle();
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);

        assertThatThrownBy(() -> articlePublicationWorkflowService.unarchive(10L, 7L))
                .isInstanceOf(InvalidPublicationTransitionException.class);
    }

    private static Article draftArticle() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);

        Article article = new Article();
        article.setId(7L);
        article.setTenant(tenant);
        article.setSlug("hello-world");
        article.setTitle("Hello world");
        article.setBody("<p>Hello world</p>");
        article.setAccessPolicy(AccessPolicy.FREE);
        article.setStatus(ArticleStatus.DRAFT);
        return article;
    }
}
