package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
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
@RequiresModule(PodcastRssModule.KEY)
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant/subscriber-feeds")
public class TenantSubscriberFeedController {

    private final SubscriberFeedService subscriberFeedService;
    private final ModuleGateService moduleGateService;

    public TenantSubscriberFeedController(
            SubscriberFeedService subscriberFeedService,
            ModuleGateService moduleGateService
    ) {
        this.subscriberFeedService = subscriberFeedService;
        this.moduleGateService = moduleGateService;
    }

    /**
     * Lists all subscriber feeds of the current tenant, newest first.
     *
     * @return the tenant's subscriber feeds
     */
    @GetMapping
    ResponseEntity<Response<List<SubscriberFeedAdminView>>> listFeeds() {
        Long tenantId = TenantContext.requireTenantId();
        moduleGateService.requireModule(SubscriptionModule.MODULE_KEY);
        List<SubscriberFeedAdminView> feeds = subscriberFeedService.listTenantFeeds(tenantId).stream()
                .map(TenantSubscriberFeedController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(feeds));
    }

    @PutMapping("/{feedId}/enabled")
    ResponseEntity<Response<SubscriberFeedAdminView>> setEnabled(
            @PathVariable Long feedId,
            @Valid @RequestBody FeedEnabledRequest body
    ) {
        Long tenantId = TenantContext.requireTenantId();
        moduleGateService.requireModule(SubscriptionModule.MODULE_KEY);
        SubscriberFeed feed = subscriberFeedService.setFeedEnabled(tenantId, feedId, body.enabled());
        return ResponseEntity.ok(Response.ok(toView(feed)));
    }

    private static SubscriberFeedAdminView toView(SubscriberFeed feed) {
        return new SubscriberFeedAdminView(
                feed.getId(),
                feed.getUser().getId(),
                feed.getUser().getEmail(),
                feed.getTitle(),
                feed.isDefaultFeed(),
                feed.isEnabled(),
                feed.getCreatedAt(),
                feed.getUpdatedAt()
        );
    }

    public record FeedEnabledRequest(@NotNull Boolean enabled) {
    }

    public record SubscriberFeedAdminView(
            Long id,
            Long userId,
            String userEmail,
            String title,
            boolean isDefault,
            boolean enabled,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
