package de.pnnit.directwerk.controller.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.PublicArticleViewMapper;
import de.pnnit.directwerk.api.dto.MeArticleView;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.access.SubscriberPortalArticleAccessService;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
class MeArticleControllerTest {

    @Mock
    private SubscriberPortalArticleAccessService subscriberPortalArticleAccessService;

    @Mock
    private PublicArticleViewMapper publicArticleViewMapper;

    @Mock
    private de.pnnit.directwerk.modules.newsletter.service.ArticleViewAnalyticsService articleViewAnalyticsService;

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void listArticlesReturnsEntitledPortalViews() {
        TenantContext.setTenantId(10L);
        MeArticleController controller = new MeArticleController(
                subscriberPortalArticleAccessService,
                publicArticleViewMapper,
                articleViewAnalyticsService
        );
        DirectwerkUserPrincipal principal = subscriber();
        Article article = paidArticle();
        MeArticleView view = new MeArticleView(
                article.getId(),
                article.getSlug(),
                article.getTitle(),
                article.getBody(),
                article.getExcerpt(),
                article.getSeoDescription(),
                null,
                article.getAccessPolicy().name(),
                article.getRequiredLevelSortOrder(),
                article.getPublishedAt(),
                List.of()
        );

        when(subscriberPortalArticleAccessService.listMyArticles(principal)).thenReturn(List.of(article));
        when(publicArticleViewMapper.toPortalView(article)).thenReturn(view);

        ResponseEntity<?> response = controller.listArticles(principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    void getArticleTracksPrivateView() {
        TenantContext.setTenantId(10L);
        MeArticleController controller = new MeArticleController(
                subscriberPortalArticleAccessService,
                publicArticleViewMapper,
                articleViewAnalyticsService
        );
        DirectwerkUserPrincipal principal = subscriber();
        Article article = paidArticle();
        MeArticleView view = new MeArticleView(
                article.getId(),
                article.getSlug(),
                article.getTitle(),
                article.getBody(),
                article.getExcerpt(),
                article.getSeoDescription(),
                null,
                article.getAccessPolicy().name(),
                article.getRequiredLevelSortOrder(),
                article.getPublishedAt(),
                List.of()
        );
        jakarta.servlet.http.HttpServletRequest request =
                org.mockito.Mockito.mock(jakarta.servlet.http.HttpServletRequest.class);
        when(request.getServerName()).thenReturn("alpha.example.test");
        when(subscriberPortalArticleAccessService.requireEntitledArticle(principal, "premium-post"))
                .thenReturn(article);
        when(publicArticleViewMapper.toPortalView(article)).thenReturn(view);

        ResponseEntity<?> response = controller.getArticle("premium-post", principal, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(articleViewAnalyticsService).trackArticleView(
                10L, article, "private-view", "alpha.example.test", null, null);
    }

    private static DirectwerkUserPrincipal subscriber() {
        return new DirectwerkUserPrincipal(
                20L,
                "subscriber@example.test",
                "hash",
                10L,
                List.of(new SimpleGrantedAuthority(RoleConstants.SUBSCRIBER))
        );
    }

    private static Article paidArticle() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");

        Article article = new Article();
        article.setId(60L);
        article.setTenant(tenant);
        article.setSlug("premium-post");
        article.setTitle("Premium Post");
        article.setBody("<p>Full body</p>");
        article.setAccessPolicy(AccessPolicy.PAID);
        article.setRequiredLevelSortOrder(1);
        article.setStatus(ArticleStatus.PUBLISHED);
        article.setPublishedAt(Instant.parse("2026-01-01T12:00:00Z"));
        return article;
    }
}
