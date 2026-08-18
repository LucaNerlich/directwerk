package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
import de.pnnit.directwerk.modules.podcast.FeedBuilderModule;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
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
public class MeFeedController {

    private final SubscriberFeedService subscriberFeedService;
    private final ModuleGateService moduleGateService;

    public MeFeedController(
            SubscriberFeedService subscriberFeedService,
            ModuleGateService moduleGateService
    ) {
        this.subscriberFeedService = subscriberFeedService;
        this.moduleGateService = moduleGateService;
    }

    @GetMapping
    ResponseEntity<Response<List<SubscriberFeedView>>> listFeeds(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        requireFeedModules();

        subscriberFeedService.ensureDefaultFeed(user.tenantId(), user.userId());
        List<SubscriberFeedView> feeds = subscriberFeedService.listFeeds(user.tenantId(), user.userId()).stream()
                .map(feed -> toView(feed, request))
                .toList();
        return ResponseEntity.ok(Response.ok(feeds));
    }

    @PostMapping
    ResponseEntity<Response<SubscriberFeedView>> createCustomFeed(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @Valid @RequestBody CreateCustomFeedRequest body,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        requireFeedModules();
        requireFeedBuilder();

        SubscriberFeed feed = subscriberFeedService.createCustomFeed(
                user.tenantId(),
                user.userId(),
                body.title(),
                body.formatIds()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(toView(feed, request)));
    }

    @PutMapping("/{feedId}")
    ResponseEntity<Response<SubscriberFeedView>> updateCustomFeed(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId,
            @Valid @RequestBody UpdateCustomFeedRequest body,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        requireFeedModules();
        requireFeedBuilder();

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
    ResponseEntity<Response<FeedPreviewView>> previewFormats(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @RequestParam List<Long> formatIds
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        requireFeedModules();
        requireFeedBuilder();

        SubscriberFeedService.FeedPreview preview = subscriberFeedService.preview(
                user.tenantId(),
                user.userId(),
                formatIds
        );
        return ResponseEntity.ok(Response.ok(toPreviewView(preview)));
    }

    @GetMapping("/{feedId}/preview")
    ResponseEntity<Response<FeedPreviewView>> previewFeed(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @PathVariable Long feedId
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        requireFeedModules();
        requireFeedBuilder();

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
        requireFeedModules();

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
        requireFeedModules();

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
        requireFeedModules();

        SubscriberFeed feed = subscriberFeedService.deleteCustomFeed(user.tenantId(), user.userId(), feedId);
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    @PostMapping("/default/rotate-token")
    ResponseEntity<Response<SubscriberFeedView>> rotateDefaultToken(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        requireFeedModules();

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
        requireFeedModules();

        SubscriberFeed feed = subscriberFeedService.setDefaultFeedEnabled(
                user.tenantId(),
                user.userId(),
                body.enabled()
        );
        return ResponseEntity.ok(Response.ok(toView(feed, request)));
    }

    private void requireFeedModules() {
        moduleGateService.requireModule(PodcastRssModule.KEY);
        moduleGateService.requireModule(SubscriptionModule.MODULE_KEY);
    }

    private void requireFeedBuilder() {
        moduleGateService.requireModule(FeedBuilderModule.KEY);
    }

    private static SubscriberFeedView toView(SubscriberFeed feed, HttpServletRequest request) {
        String origin = PublicUrlBuilder.baseUrl(
                request.getScheme(),
                request.getServerName(),
                request.getServerPort()
        );
        String url = origin
                + "/feeds/" + feed.getTenant().getSlug()
                + "/u/" + feed.getFeedToken() + ".xml";
        List<FormatView> formats = feed.getFormats() == null
                ? List.of()
                : feed.getFormats().stream()
                        .sorted(Comparator.comparingInt(Format::getSortOrder).thenComparing(Format::getId))
                        .map(MeFeedController::toFormatView)
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

    private static FormatView toFormatView(Format format) {
        return new FormatView(
                format.getId(),
                format.getSlug(),
                format.getName(),
                format.getRequiredLevelSortOrder(),
                format.getSortOrder()
        );
    }

    private static FeedPreviewView toPreviewView(SubscriberFeedService.FeedPreview preview) {
        return new FeedPreviewView(preview.episodeCount(), preview.sampleTitles());
    }

    public record FeedEnabledRequest(@NotNull Boolean enabled) {
    }

    public record CreateCustomFeedRequest(String title, List<Long> formatIds) {
    }

    public record UpdateCustomFeedRequest(String title, List<Long> formatIds) {
    }

    public record FeedPreviewView(int episodeCount, List<String> sampleTitles) {
    }

    public record FormatView(
            Long id,
            String slug,
            String name,
            Integer requiredLevelSortOrder,
            int sortOrder
    ) {
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
