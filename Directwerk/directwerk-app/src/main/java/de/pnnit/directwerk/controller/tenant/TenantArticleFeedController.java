package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.dto.FeedEnabledRequest;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.newsletter.ArticleRssModule;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.service.ArticleFeedService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiresModule(ArticleRssModule.KEY)
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant/article-feeds")
public class TenantArticleFeedController {

    private final ArticleFeedService articleFeedService;

    public TenantArticleFeedController(
            ArticleFeedService articleFeedService
    ) {
        this.articleFeedService = articleFeedService;
    }

    /**
     * Lists all article feeds of the current tenant, oldest first.
     *
     * @return the tenant's article feeds
     */
    @GetMapping
    @RequiresModule({ArticleRssModule.KEY, SubscriptionModule.MODULE_KEY})
    ResponseEntity<Response<List<ArticleFeedAdminView>>> listFeeds() {
        Long tenantId = TenantContext.requireTenantId();
        List<ArticleFeedAdminView> feeds = articleFeedService.listTenantFeeds(tenantId).stream()
                .map(TenantArticleFeedController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(feeds));
    }

    @PutMapping("/{feedId}/enabled")
    @RequiresModule({ArticleRssModule.KEY, SubscriptionModule.MODULE_KEY})
    ResponseEntity<Response<ArticleFeedAdminView>> setEnabled(
            @PathVariable Long feedId,
            @Valid @RequestBody FeedEnabledRequest body
    ) {
        Long tenantId = TenantContext.requireTenantId();
        ArticleFeed feed = articleFeedService.setFeedEnabled(tenantId, feedId, body.enabled());
        return ResponseEntity.ok(Response.ok(toView(feed)));
    }

    private static ArticleFeedAdminView toView(ArticleFeed feed) {
        List<PublicCategoryView> categories = feed.getCategories() == null
                ? List.of()
                : feed.getCategories().stream()
                        .sorted(Comparator.comparing(Category::getName).thenComparing(Category::getId))
                        .map(PublicCategoryView::of)
                        .toList();
        return new ArticleFeedAdminView(
                feed.getId(),
                feed.getUser().getId(),
                feed.getUser().getEmail(),
                feed.getTitle(),
                feed.isDefaultFeed(),
                feed.isEnabled(),
                categories.stream().map(PublicCategoryView::id).toList(),
                categories,
                feed.getCreatedAt(),
                feed.getUpdatedAt()
        );
    }

    public record ArticleFeedAdminView(
            Long id,
            Long userId,
            String userEmail,
            String title,
            boolean isDefault,
            boolean enabled,
            List<Long> categoryIds,
            List<PublicCategoryView> categories,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
