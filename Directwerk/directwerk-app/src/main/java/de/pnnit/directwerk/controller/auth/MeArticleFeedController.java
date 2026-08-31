package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.dto.FeedEnabledRequest;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.util.FeedUrlResolver;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.newsletter.ArticleFeedBuilderModule;
import de.pnnit.directwerk.modules.newsletter.ArticleRssModule;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.service.ArticleFeedService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PreAuthorize("isAuthenticated()")
@RequestMapping("/api/v1/me/article-feeds")
@RequiresModule({ArticleRssModule.KEY, SubscriptionModule.MODULE_KEY})
public class MeArticleFeedController {

    private final ArticleFeedService articleFeedService;
    private final FeedUrlResolver feedUrlResolver;

    public MeArticleFeedController(
            ArticleFeedService articleFeedService,
            FeedUrlResolver feedUrlResolver
    ) {
        this.articleFeedService = articleFeedService;
        this.feedUrlResolver = feedUrlResolver;
    }

    @GetMapping
    ResponseEntity<Response<List<ArticleFeedView>>> listFeeds(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        articleFeedService.ensureDefaultFeed(user.tenantId(), user.userId());
        List<ArticleFeedView> feeds = articleFeedService.listFeeds(user.tenantId(), user.userId()).stream()
                .map(feed -> toView(feed, request))
                .toList();
        return ResponseEntity.ok(Response.ok(feeds));
    }

    @PostMapping
    @RequiresModule({ArticleRssModule.KEY, SubscriptionModule.MODULE_KEY, ArticleFeedBuilderModule.KEY})
    ResponseEntity<Response<ArticleFeedView>> createCustomFeed(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @RequestBody CreateCustomFeedRequest body,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        ArticleFeed feed = articleFeedService.createCustomFeed(
                user.tenantId(),
                user.userId(),
                body.title(),
                body.categoryIds()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(toView(feed, request)));
    }

    @PutMapping("/{feedId}")
    @RequiresModule({ArticleRssModule.KEY, SubscriptionModule.MODULE_KEY, ArticleFeedBuilderModule.KEY})
    ResponseEntity<Response<ArticleFeedView>> updateCustomFeed(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId,
            @RequestBody UpdateCustomFeedRequest body,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        ArticleFeed feed = articleFeedService.updateCustomFeed(
                user.tenantId(),
                user.userId(),
                feedId,
                body.title(),
                body.categoryIds()
        );
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    @GetMapping("/preview")
    @RequiresModule({ArticleRssModule.KEY, SubscriptionModule.MODULE_KEY, ArticleFeedBuilderModule.KEY})
    ResponseEntity<Response<FeedPreviewView>> previewCategories(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @RequestParam List<Long> categoryIds
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        ArticleFeedService.FeedPreview preview = articleFeedService.preview(
                user.tenantId(),
                user.userId(),
                categoryIds
        );
        return ResponseEntity.ok(Response.ok(toPreviewView(preview)));
    }

    @GetMapping("/{feedId}/preview")
    @RequiresModule({ArticleRssModule.KEY, SubscriptionModule.MODULE_KEY, ArticleFeedBuilderModule.KEY})
    ResponseEntity<Response<FeedPreviewView>> previewFeed(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        ArticleFeedService.FeedPreview preview = articleFeedService.previewOwnedFeed(
                user.tenantId(),
                user.userId(),
                feedId
        );
        return ResponseEntity.ok(Response.ok(toPreviewView(preview)));
    }

    @PutMapping("/{feedId}/enabled")
    ResponseEntity<Response<ArticleFeedView>> setFeedEnabled(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId,
            @Valid @RequestBody FeedEnabledRequest body,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        ArticleFeed feed = articleFeedService.setOwnedFeedEnabled(
                user.tenantId(),
                user.userId(),
                feedId,
                body.enabled()
        );
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    @PostMapping("/{feedId}/rotate-token")
    ResponseEntity<Response<ArticleFeedView>> rotateFeedToken(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        ArticleFeed feed = articleFeedService.rotateOwnedFeedToken(
                user.tenantId(),
                user.userId(),
                feedId
        );
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    @DeleteMapping("/{feedId}")
    ResponseEntity<Response<ArticleFeedView>> deleteCustomFeed(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        ArticleFeed feed = articleFeedService.deleteCustomFeed(user.tenantId(), user.userId(), feedId);
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    @PostMapping("/default/rotate-token")
    ResponseEntity<Response<ArticleFeedView>> rotateDefaultToken(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        ArticleFeed feed = articleFeedService.rotateDefaultFeedToken(user.tenantId(), user.userId());
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    @PutMapping("/default/enabled")
    ResponseEntity<Response<ArticleFeedView>> setDefaultFeedEnabled(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @Valid @RequestBody FeedEnabledRequest body,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        ArticleFeed feed = articleFeedService.setDefaultFeedEnabled(
                user.tenantId(),
                user.userId(),
                body.enabled()
        );
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    private ArticleFeedView toView(ArticleFeed feed, HttpServletRequest request) {
        String url = feedUrlResolver.articleSubscriberFeedUrl(
                feed.getTenant().getId(),
                request.getServerName(),
                request.getScheme(),
                request.getServerPort(),
                feed.getTenant().getSlug(),
                feed.getFeedToken()
        );
        List<PublicCategoryView> categories = feed.getCategories() == null
                ? List.of()
                : feed.getCategories().stream()
                        .sorted(Comparator.comparing(Category::getName).thenComparing(Category::getId))
                        .map(PublicCategoryView::of)
                        .toList();
        return new ArticleFeedView(
                feed.getId(),
                feed.getTitle(),
                feed.isDefaultFeed(),
                feed.isEnabled(),
                url,
                categories.stream().map(PublicCategoryView::id).toList(),
                categories,
                feed.getCreatedAt(),
                feed.getUpdatedAt()
        );
    }

    private static FeedPreviewView toPreviewView(ArticleFeedService.FeedPreview preview) {
        return new FeedPreviewView(preview.articleCount(), preview.sampleTitles());
    }

    public record CreateCustomFeedRequest(String title, List<Long> categoryIds) {
    }

    public record UpdateCustomFeedRequest(String title, List<Long> categoryIds) {
    }

    public record FeedPreviewView(int articleCount, List<String> sampleTitles) {
    }

    public record ArticleFeedView(
            Long id,
            String title,
            boolean isDefault,
            boolean enabled,
            String url,
            List<Long> categoryIds,
            List<PublicCategoryView> categories,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
