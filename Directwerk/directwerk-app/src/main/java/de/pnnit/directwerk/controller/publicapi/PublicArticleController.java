package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.PublicArticleViewMapper;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.controller.RequestClientIpExtractor;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.service.ArticleViewAnalyticsService;
import de.pnnit.directwerk.modules.newsletter.service.PublicArticleQueryService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
@RequiresModule(DigitalContentModule.KEY)
public class PublicArticleController {

    private final PublicArticleQueryService publicArticleQueryService;
    private final PublicArticleViewMapper publicArticleViewMapper;
    private final CategoryService categoryService;
    private final ArticleViewAnalyticsService articleViewAnalyticsService;

    public PublicArticleController(
            PublicArticleQueryService publicArticleQueryService,
            PublicArticleViewMapper publicArticleViewMapper,
            CategoryService categoryService,
            ArticleViewAnalyticsService articleViewAnalyticsService
    ) {
        this.publicArticleQueryService = publicArticleQueryService;
        this.publicArticleViewMapper = publicArticleViewMapper;
        this.categoryService = categoryService;
        this.articleViewAnalyticsService = articleViewAnalyticsService;
    }

    /**
     * Active categories available for filtering article feeds. Not gated on {@code PODCAST} —
     * {@code Category} is a shared digital-content taxonomy, so this uses a distinct path from
     * {@code PublicPodcastController#listCategories} rather than depending on a podcast-only
     * endpoint from an article-only tenant.
     */
    @GetMapping("/article-categories")
    ResponseEntity<Response<List<PublicCategoryView>>> listCategories() {
        Long tenantId = TenantContext.getTenantId();
        List<PublicCategoryView> categories = categoryService.listCategories(tenantId, true).stream()
                .map(PublicCategoryView::of)
                .toList();
        return ResponseEntity.ok(Response.ok(categories));
    }

    @GetMapping("/articles")
    ResponseEntity<Response<List<PublicArticleView>>> listArticles() {
        Long tenantId = TenantContext.getTenantId();
        List<PublicArticleView> articles = publicArticleQueryService.listPublishedArticles(tenantId).stream()
                .map(publicArticleViewMapper::toPublicView)
                .toList();
        return ResponseEntity.ok(Response.ok(articles));
    }

    /**
     * Retrieves a published article by its slug for the current tenant and records a public view.
     *
     * @param slug the article slug
     * @return the published article's public view
     */
    @GetMapping("/articles/{slug}")
    ResponseEntity<Response<PublicArticleView>> getArticle(
            @PathVariable String slug,
            HttpServletRequest request
    ) {
        Long tenantId = TenantContext.getTenantId();
        Article article = publicArticleQueryService.requirePublishedArticle(tenantId, slug);
        articleViewAnalyticsService.trackArticleView(
                tenantId,
                article,
                "public-view",
                request.getServerName(),
                request.getHeader("User-Agent"),
                RequestClientIpExtractor.extract(request));
        return ResponseEntity.ok(Response.ok(publicArticleViewMapper.toPublicView(article)));
    }

    public record PublicArticleView(
            Long id,
            String slug,
            String title,
            String body,
            String excerpt,
            String seoDescription,
            Long heroAssetId,
            String accessPolicy,
            Integer requiredLevelSortOrder,
            Instant publishedAt,
            List<PublicCategoryView> categories
    ) {
    }
}
