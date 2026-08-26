package de.pnnit.directwerk.controller.newsletter;

import de.pnnit.directwerk.api.dto.CategoryView;
import de.pnnit.directwerk.api.dto.PublishOptionsRequest;
import de.pnnit.directwerk.api.dto.ReplaceCategoriesRequest;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.newsletter.service.ArticlePublicationWorkflowService;
import de.pnnit.directwerk.modules.newsletter.service.ArticleService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiresModule(DigitalContentModule.KEY)
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/articles")
public class ArticleController {

    private final ArticleService articleService;
    private final ArticlePublicationWorkflowService articlePublicationWorkflowService;

    public ArticleController(
            ArticleService articleService,
            ArticlePublicationWorkflowService articlePublicationWorkflowService
    ) {
        this.articleService = articleService;
        this.articlePublicationWorkflowService = articlePublicationWorkflowService;
    }

    @GetMapping
    ResponseEntity<Response<List<ArticleView>>> listArticles() {
        Long tenantId = TenantContext.requireTenantId();
        List<ArticleView> articles = articleService.listArticles(tenantId).stream()
                .map(ArticleController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(articles));
    }

    @GetMapping("/{articleId}")
    ResponseEntity<Response<ArticleView>> getArticle(@PathVariable Long articleId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(articleService.requireArticle(tenantId, articleId))));
    }

    @PostMapping
    ResponseEntity<Response<ArticleView>> createDraft(@Valid @RequestBody CreateArticleRequest request) {
        Long tenantId = TenantContext.requireTenantId();
                Article article = articleService.createDraft(
                tenantId,
                request.slug(),
                request.title(),
                request.body(),
                request.excerpt(),
                request.seoDescription(),
                request.heroAssetId(),
                request.accessPolicy(),
                request.requiredLevelSortOrder(),
                request.categoryIds()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(toView(article)));
    }

    @PutMapping("/{articleId}")
    ResponseEntity<Response<ArticleView>> updateDraft(
            @PathVariable Long articleId,
            @Valid @RequestBody UpdateArticleRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
                Article article = articleService.updateDraft(
                tenantId,
                articleId,
                request.slug(),
                request.title(),
                request.body(),
                request.excerpt(),
                request.seoDescription(),
                request.heroAssetId(),
                request.accessPolicy(),
                request.requiredLevelSortOrder(),
                request.clearHeroAsset()
        );
        return ResponseEntity.ok(Response.ok(toView(article)));
    }

    @PutMapping("/{articleId}/categories")
    ResponseEntity<Response<ArticleView>> replaceCategories(
            @PathVariable Long articleId,
            @Valid @RequestBody ReplaceCategoriesRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(
                articleService.replaceCategories(tenantId, articleId, request.categoryIds())
        )));
    }

    @PostMapping("/{articleId}/publish")
    ResponseEntity<Response<ArticleView>> publish(
            @PathVariable Long articleId,
            @RequestBody(required = false) PublishOptionsRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        boolean notifySubscribers = request != null && Boolean.TRUE.equals(request.notifySubscribers());
        return ResponseEntity.ok(Response.ok(toView(
                articlePublicationWorkflowService.publish(tenantId, articleId, notifySubscribers)
        )));
    }

    @PostMapping("/{articleId}/schedule")
    ResponseEntity<Response<ArticleView>> schedule(
            @PathVariable Long articleId,
            @Valid @RequestBody ScheduleArticleRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        Article article = articlePublicationWorkflowService.schedule(
                tenantId,
                articleId,
                request.scheduledAt(),
                Boolean.TRUE.equals(request.notifySubscribers())
        );
        return ResponseEntity.ok(Response.ok(toView(article)));
    }

    @PostMapping("/{articleId}/cancel-schedule")
    ResponseEntity<Response<ArticleView>> cancelSchedule(@PathVariable Long articleId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(
                articlePublicationWorkflowService.cancelSchedule(tenantId, articleId)
        )));
    }

    @PostMapping("/{articleId}/unpublish")
    ResponseEntity<Response<ArticleView>> unpublish(@PathVariable Long articleId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(
                articlePublicationWorkflowService.unpublish(tenantId, articleId)
        )));
    }

    @PostMapping("/{articleId}/archive")
    ResponseEntity<Response<ArticleView>> archive(@PathVariable Long articleId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(
                articlePublicationWorkflowService.archive(tenantId, articleId)
        )));
    }

    @PostMapping("/{articleId}/unarchive")
    ResponseEntity<Response<ArticleView>> unarchive(@PathVariable Long articleId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(toView(
                articlePublicationWorkflowService.unarchive(tenantId, articleId)
        )));
    }

    public static ArticleView toView(Article article) {
        return new ArticleView(
                article.getId(),
                article.getSlug(),
                article.getTitle(),
                article.getBody(),
                article.getExcerpt(),
                article.getSeoDescription(),
                article.getHeroAsset() != null ? article.getHeroAsset().getId() : null,
                article.getAccessPolicy().name(),
                article.getRequiredLevelSortOrder(),
                article.getStatus().name(),
                article.getPublishedAt(),
                article.getScheduledAt(),
                article.getCategories().stream()
                        .sorted(CategoryView.DISPLAY_ORDER)
                        .map(CategoryView::of)
                        .toList(),
                article.getCreatedAt(),
                article.getUpdatedAt()
        );
    }

    public record CreateArticleRequest(
            @NotBlank
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @NotBlank @Size(max = 255) String title,
            String body,
            String excerpt,
            @Size(max = 512) String seoDescription,
            @Min(1) Long heroAssetId,
            AccessPolicy accessPolicy,
            @Min(0) Integer requiredLevelSortOrder,
            Set<@Min(1) Long> categoryIds
    ) {
    }

    public record UpdateArticleRequest(
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @Size(max = 255) String title,
            String body,
            String excerpt,
            @Size(max = 512) String seoDescription,
            @Min(1) Long heroAssetId,
            AccessPolicy accessPolicy,
            @Min(0) Integer requiredLevelSortOrder,
            Boolean clearHeroAsset
    ) {
    }

    public record ScheduleArticleRequest(
            @NotNull Instant scheduledAt,
            Boolean notifySubscribers
    ) {
    }

    public record ArticleView(
            Long id,
            String slug,
            String title,
            String body,
            String excerpt,
            String seoDescription,
            Long heroAssetId,
            String accessPolicy,
            Integer requiredLevelSortOrder,
            String status,
            Instant publishedAt,
            Instant scheduledAt,
            List<CategoryView> categories,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
