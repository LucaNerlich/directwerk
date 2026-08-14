package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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

    /**
     * Ensures the podcast RSS and subscription modules are available.
     */
    private void requireFeedModules() {
        moduleGateService.requireModule(PodcastRssModule.KEY);
        moduleGateService.requireModule(SubscriptionModule.MODULE_KEY);
    }

    /**
     * Converts a subscriber feed into its response representation with a public XML feed URL.
     *
     * @param feed    the subscriber feed to represent
     * @param request the request used to determine the public host
     * @return the feed response view
     */
    private static SubscriberFeedView toView(SubscriberFeed feed, HttpServletRequest request) {
        // Match SeriesController / site-config: use the request scheme and port so local
        // http://tenant.localhost:8080 feeds open without forcing HTTPS.
        String origin = PublicUrlBuilder.baseUrl(
                request.getScheme(),
                request.getServerName(),
                request.getServerPort()
        );
        String url = origin
                + "/feeds/" + feed.getTenant().getSlug()
                + "/u/" + feed.getFeedToken() + ".xml";
        return new SubscriberFeedView(
                feed.getId(),
                feed.getTitle(),
                feed.isDefaultFeed(),
                feed.isEnabled(),
                url,
                feed.getCreatedAt(),
                feed.getUpdatedAt()
        );
    }

    public record FeedEnabledRequest(@NotNull Boolean enabled) {
    }

    public record SubscriberFeedView(
            Long id,
            String title,
            boolean isDefault,
            boolean enabled,
            String url,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
