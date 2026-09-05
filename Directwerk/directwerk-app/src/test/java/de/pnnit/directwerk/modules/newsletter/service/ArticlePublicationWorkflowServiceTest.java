package de.pnnit.directwerk.modules.newsletter.service;

import static de.pnnit.directwerk.testsupport.RbacTestFixtures.override;
import de.pnnit.directwerk.modules.core.notification.SubscriberNotificationGate;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.RestrictionScope;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.exception.ContentAccessDeniedException;
import de.pnnit.directwerk.modules.core.repository.MembershipPermissionOverrideRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.content.ContentPublishedEvent;
import de.pnnit.directwerk.modules.content.ContentPublishedNotifier;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.ScheduledPublicationExecutor;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleValidationException;
import de.pnnit.directwerk.modules.newsletter.job.ArticleRssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.content.InvalidPublicationTransitionException;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

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

    @Mock
    private SubscriberNotificationGate notificationGate;

    @Mock
    private ArticleRssFeedRefreshJobProducer articleRssFeedRefreshScheduler;

    @Mock
    private ObjectProvider<ArticlePublicationWorkflowService> selfProvider;

    @Mock
    private PlatformAuditService platformAuditService;

    @Mock
    private MembershipPermissionOverrideRepository overrideRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;

    @Mock
    private TenantRepository tenantRepository;


    private ScheduledPublicationExecutor scheduledPublicationExecutor;

    @BeforeEach
    void setUp() {
        scheduledPublicationExecutor = new ScheduledPublicationExecutor(moduleGateService);
        articlePublicationWorkflowService = new ArticlePublicationWorkflowService(
                articleRepository,
                articleService,
                new de.pnnit.directwerk.modules.digital.service.HtmlSanitizer(),
                moduleGateService,
                scheduledPublicationExecutor,
                contentPublishedNotifier,
                notificationGate,
                articleRssFeedRefreshScheduler,
                selfProvider,
                new MembershipPermissionService(
                        overrideRepository, tenantMembershipRepository, tenantRepository,
                        platformAuditService)
        );
        lenient().when(notificationGate.enabled(anyLong(), any(), anyLong())).thenReturn(true);
        lenient().when(selfProvider.getObject()).thenReturn(articlePublicationWorkflowService);
        lenient().when(articleRepository.save(any(Article.class))).thenAnswer(invocation -> invocation.getArgument(0));
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void publishDraftArticleSetsPublishedState() {
        Article article = draftArticle();
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);

        Article published = articlePublicationWorkflowService.publish(10L, 7L);

        assertThat(published.getStatus()).isEqualTo(ArticleStatus.PUBLISHED);
        assertThat(published.getPublishedAt()).isNotNull();
        assertThat(published.getBody()).contains("<p>Hello world</p>");
        verify(articleRssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    @Test
    void publishWithBackdatedPublishedAt() {
        Instant backdated = Instant.parse("2020-06-01T12:00:00Z");
        Article article = draftArticle();
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);

        Article published = articlePublicationWorkflowService.publish(10L, 7L, false, backdated);

        assertThat(published.getPublishedAt()).isEqualTo(backdated);
    }

    @Test
    void publishRejectsFuturePublishedAt() {
        Article article = draftArticle();
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);

        assertThatThrownBy(() -> articlePublicationWorkflowService.publish(
                10L,
                7L,
                false,
                Instant.parse("2099-01-01T00:00:00Z")
        ))
                .isInstanceOf(InvalidPublicationTransitionException.class)
                .hasMessageContaining("publishedAt");
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
        // notificationGate mock is stubbed lenient() in setUp; email/EMAIL_NOTIFY gates live there now.
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
        // notificationGate mock is stubbed lenient() in setUp; email/EMAIL_NOTIFY gates live there now.
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
    void unpublishRefreshesRssFeed() {
        Article article = draftArticle();
        article.setStatus(ArticleStatus.PUBLISHED);
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);

        Article unpublished = articlePublicationWorkflowService.unpublish(10L, 7L);

        assertThat(unpublished.getStatus()).isEqualTo(ArticleStatus.DRAFT);
        verify(articleRssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
    }

    @Test
    void archiveRefreshesRssFeed() {
        Article article = draftArticle();
        article.setStatus(ArticleStatus.PUBLISHED);
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);

        Article archived = articlePublicationWorkflowService.archive(10L, 7L);

        assertThat(archived.getStatus()).isEqualTo(ArticleStatus.ARCHIVED);
        verify(articleRssFeedRefreshScheduler).requestRefreshAfterCommit(10L);
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

    @Test
    void publishDeniedForStrangerWithOwnOnlyRestriction() {
        Article article = draftArticle();
        article.setCreatedBy(99L);
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);
        when(overrideRepository.findByTenantIdAndUserId(10L, 5L)).thenReturn(List.of(
                override(ContentEntityType.ARTICLE, ContentOperation.PUBLISH, RestrictionScope.OTHERS_ONLY)));
        authenticate(5L, Role.EDITOR);

        assertThatThrownBy(() -> articlePublicationWorkflowService.publish(10L, 7L))
                .isInstanceOf(ContentAccessDeniedException.class)
                .extracting(ex -> ((ContentAccessDeniedException) ex).getCode())
                .isEqualTo(ContentAccessDeniedException.NOT_CONTENT_OWNER);
        verify(articleRepository, never()).save(any(Article.class));
    }

    @Test
    void publishAllowedForOwnerWithOwnOnlyRestriction() {
        Article article = draftArticle();
        article.setCreatedBy(5L);
        when(articleService.requireArticle(10L, 7L)).thenReturn(article);
        when(overrideRepository.findByTenantIdAndUserId(10L, 5L)).thenReturn(List.of(
                override(ContentEntityType.ARTICLE, ContentOperation.PUBLISH, RestrictionScope.OTHERS_ONLY)));
        authenticate(5L, Role.EDITOR);

        Article published = articlePublicationWorkflowService.publish(10L, 7L);

        assertThat(published.getStatus()).isEqualTo(ArticleStatus.PUBLISHED);
    }

    private static void authenticate(Long userId, Role... roles) {
        List<SimpleGrantedAuthority> authorities = Arrays.stream(roles)
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                .toList();
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                userId, "user@example.com", "hash", 10L, authorities);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, authorities));
    }

}
