package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.newsletter.service.PublicArticleQueryService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.Comparator;
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

    public PublicArticleController(
            PublicArticleQueryService publicArticleQueryService
    ) {
        this.publicArticleQueryService = publicArticleQueryService;
    }

    @GetMapping("/articles")
    ResponseEntity<Response<List<PublicArticleView>>> listArticles() {
        Long tenantId = TenantContext.getTenantId();
        List<PublicArticleView> articles = publicArticleQueryService.listPublishedArticles(tenantId).stream()
                .map(PublicArticleController::toPublicView)
                .toList();
        return ResponseEntity.ok(Response.ok(articles));
    }

    @GetMapping("/articles/{slug}")
    ResponseEntity<Response<PublicArticleView>> getArticle(@PathVariable String slug) {
        Long tenantId = TenantContext.getTenantId();
        return ResponseEntity.ok(Response.ok(toPublicView(
                publicArticleQueryService.requirePublishedArticle(tenantId, slug)
        )));
    }

    private static PublicArticleView toPublicView(Article article) {
        boolean includeBody = article.getAccessPolicy() == AccessPolicy.FREE;
        return new PublicArticleView(
                article.getId(),
                article.getSlug(),
                article.getTitle(),
                includeBody ? article.getBody() : null,
                article.getExcerpt(),
                article.getSeoDescription(),
                article.getHeroAsset() != null ? article.getHeroAsset().getId() : null,
                article.getAccessPolicy().name(),
                article.getRequiredLevelSortOrder(),
                article.getPublishedAt(),
                article.getCategories().stream()
                        .sorted(Comparator.comparing(Category::getName).thenComparing(Category::getId))
                        .map(PublicArticleController::toCategoryView)
                        .toList()
        );
    }

    private static PublicCategoryView toCategoryView(Category category) {
        return new PublicCategoryView(
                category.getId(),
                category.getSlug(),
                category.getName(),
                category.getParent() != null ? category.getParent().getId() : null
        );
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
