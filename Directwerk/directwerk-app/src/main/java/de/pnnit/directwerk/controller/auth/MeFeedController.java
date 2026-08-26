package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.dto.FeedEnabledRequest;
import de.pnnit.directwerk.api.dto.FormatView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.util.FeedUrls;
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
import de.pnnit.directwerk.modules.podcast.FeedBuilderModule;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedService;
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
@RequestMapping("/api/v1/me/feeds")
@RequiresModule({PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY})
public class MeFeedController {

    private final SubscriberFeedService subscriberFeedService;

    public MeFeedController(
            SubscriberFeedService subscriberFeedService
    ) {
        this.subscriberFeedService = subscriberFeedService;
    }

    @GetMapping
    ResponseEntity<Response<List<SubscriberFeedView>>> listFeeds(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        subscriberFeedService.ensureDefaultFeed(user.tenantId(), user.userId());
        List<SubscriberFeedView> feeds = subscriberFeedService.listFeeds(user.tenantId(), user.userId()).stream()
                .map(feed -> toView(feed, request))
                .toList();
        return ResponseEntity.ok(Response.ok(feeds));
    }

    @PostMapping
    @RequiresModule({PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY, FeedBuilderModule.KEY})
    ResponseEntity<Response<SubscriberFeedView>> createCustomFeed(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @RequestBody CreateCustomFeedRequest body,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        SubscriberFeed feed = subscriberFeedService.createCustomFeed(
                user.tenantId(),
                user.userId(),
                body.title(),
                body.formatIds()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(toView(feed, request)));
    }

    @PutMapping("/{feedId}")
    @RequiresModule({PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY, FeedBuilderModule.KEY})
    ResponseEntity<Response<SubscriberFeedView>> updateCustomFeed(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId,
            @RequestBody UpdateCustomFeedRequest body,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        SubscriberFeed feed = subscriberFeedService.updateCustomFeed(
                user.tenantId(),
                user.userId(),
                feedId,
                body.title(),
                body.formatIds()
        );
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    @GetMapping("/preview")
    @RequiresModule({PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY, FeedBuilderModule.KEY})
    ResponseEntity<Response<FeedPreviewView>> previewFormats(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @RequestParam List<Long> formatIds
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        SubscriberFeedService.FeedPreview preview = subscriberFeedService.preview(
                user.tenantId(),
                user.userId(),
                formatIds
        );
        return ResponseEntity.ok(Response.ok(toPreviewView(preview)));
    }

    @GetMapping("/{feedId}/preview")
    @RequiresModule({PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY, FeedBuilderModule.KEY})
    ResponseEntity<Response<FeedPreviewView>> previewFeed(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        SubscriberFeedService.FeedPreview preview = subscriberFeedService.previewOwnedFeed(
                user.tenantId(),
                user.userId(),
                feedId
        );
        return ResponseEntity.ok(Response.ok(toPreviewView(preview)));
    }

    @PutMapping("/{feedId}/enabled")
    ResponseEntity<Response<SubscriberFeedView>> setFeedEnabled(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId,
            @Valid @RequestBody FeedEnabledRequest body,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        SubscriberFeed feed = subscriberFeedService.setOwnedFeedEnabled(
                user.tenantId(),
                user.userId(),
                feedId,
                body.enabled()
        );
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    @PostMapping("/{feedId}/rotate-token")
    ResponseEntity<Response<SubscriberFeedView>> rotateFeedToken(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        SubscriberFeed feed = subscriberFeedService.rotateOwnedFeedToken(
                user.tenantId(),
                user.userId(),
                feedId
        );
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    @DeleteMapping("/{feedId}")
    ResponseEntity<Response<SubscriberFeedView>> deleteCustomFeed(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        SubscriberFeed feed = subscriberFeedService.deleteCustomFeed(user.tenantId(), user.userId(), feedId);
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    @PostMapping("/default/rotate-token")
    ResponseEntity<Response<SubscriberFeedView>> rotateDefaultToken(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        SubscriberFeed feed = subscriberFeedService.rotateDefaultFeedToken(user.tenantId(), user.userId());
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    @PutMapping("/default/enabled")
    ResponseEntity<Response<SubscriberFeedView>> setDefaultFeedEnabled(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @Valid @RequestBody FeedEnabledRequest body,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        SubscriberFeed feed = subscriberFeedService.setDefaultFeedEnabled(
                user.tenantId(),
                user.userId(),
                body.enabled()
        );
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    private static SubscriberFeedView toView(SubscriberFeed feed, HttpServletRequest request) {
        String origin = PublicUrlBuilder.baseUrl(
                request.getScheme(),
                request.getServerName(),
                request.getServerPort()
        );
        String url = FeedUrls.subscriberFeed(origin, feed.getTenant().getSlug(), feed.getFeedToken());
        List<FormatView> formats = feed.getFormats() == null
                ? List.of()
                : feed.getFormats().stream()
                        .sorted(FormatView.DISPLAY_ORDER)
                        .map(FormatView::of)
                        .toList();
        return new SubscriberFeedView(
                feed.getId(),
                feed.getTitle(),
                feed.isDefaultFeed(),
                feed.isEnabled(),
                url,
                formats.stream().map(FormatView::id).toList(),
                formats,
                feed.getCreatedAt(),
                feed.getUpdatedAt()
        );
    }

    private static FeedPreviewView toPreviewView(SubscriberFeedService.FeedPreview preview) {
        return new FeedPreviewView(preview.episodeCount(), preview.sampleTitles());
    }

    public record CreateCustomFeedRequest(String title, List<Long> formatIds) {
    }

    public record UpdateCustomFeedRequest(String title, List<Long> formatIds) {
    }

    public record FeedPreviewView(int episodeCount, List<String> sampleTitles) {
    }

    public record SubscriberFeedView(
            Long id,
            String title,
            boolean isDefault,
            boolean enabled,
            String url,
            List<Long> formatIds,
            List<FormatView> formats,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
