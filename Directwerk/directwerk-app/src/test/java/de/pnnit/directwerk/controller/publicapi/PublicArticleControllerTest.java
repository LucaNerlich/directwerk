package de.pnnit.directwerk.controller.publicapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.PublicArticleViewMapper;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.service.ArticleViewAnalyticsService;
import de.pnnit.directwerk.modules.newsletter.service.PublicArticleQueryService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
class PublicArticleControllerTest {

    @Mock
    private PublicArticleQueryService publicArticleQueryService;

    @Mock
    private PublicArticleViewMapper publicArticleViewMapper;

    @Mock
    private CategoryService categoryService;

    @Mock
    private ArticleViewAnalyticsService articleViewAnalyticsService;

    @Mock
    private HttpServletRequest request;

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void getArticleTracksPublicViewAndReturnsMappedArticle() {
        TenantContext.setTenantId(10L);
        Article article = freeArticle();
        PublicArticleController.PublicArticleView view = new PublicArticleController.PublicArticleView(
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
        when(publicArticleQueryService.requirePublishedArticle(10L, "article-1")).thenReturn(article);
        when(publicArticleViewMapper.toPublicView(article)).thenReturn(view);
        when(request.getServerName()).thenReturn("alpha.example.test");

        ResponseEntity<?> response = controller().getArticle("article-1", request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(articleViewAnalyticsService)
                .trackArticleView(10L, article, "public-view", "alpha.example.test");
    }

    private PublicArticleController controller() {
        return new PublicArticleController(
                publicArticleQueryService,
                publicArticleViewMapper,
                categoryService,
                articleViewAnalyticsService
        );
    }

    private static Article freeArticle() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");

        Article article = new Article();
        article.setId(30L);
        article.setTenant(tenant);
        article.setSlug("article-1");
        article.setTitle("Article 1");
        article.setAccessPolicy(AccessPolicy.FREE);
        article.setStatus(ArticleStatus.PUBLISHED);
        return article;
    }
}
