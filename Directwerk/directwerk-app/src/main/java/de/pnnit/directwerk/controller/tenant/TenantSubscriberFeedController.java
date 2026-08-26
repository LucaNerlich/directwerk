package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.dto.FeedEnabledRequest;
import de.pnnit.directwerk.api.dto.FormatView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedService;
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
@RequiresModule(PodcastRssModule.KEY)
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant/subscriber-feeds")
public class TenantSubscriberFeedController {

    private final SubscriberFeedService subscriberFeedService;

    public TenantSubscriberFeedController(
            SubscriberFeedService subscriberFeedService
    ) {
        this.subscriberFeedService = subscriberFeedService;
    }

    /**
     * Lists all subscriber feeds of the current tenant, newest first.
     *
     * @return the tenant's subscriber feeds
     */
    @GetMapping
    @RequiresModule({PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY})
    ResponseEntity<Response<List<SubscriberFeedAdminView>>> listFeeds() {
        Long tenantId = TenantContext.requireTenantId();
        List<SubscriberFeedAdminView> feeds = subscriberFeedService.listTenantFeeds(tenantId).stream()
                .map(TenantSubscriberFeedController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(feeds));
    }

    @PutMapping("/{feedId}/enabled")
    @RequiresModule({PodcastRssModule.KEY, SubscriptionModule.MODULE_KEY})
    ResponseEntity<Response<SubscriberFeedAdminView>> setEnabled(
            @PathVariable Long feedId,
            @Valid @RequestBody FeedEnabledRequest body
    ) {
        Long tenantId = TenantContext.requireTenantId();
        SubscriberFeed feed = subscriberFeedService.setFeedEnabled(tenantId, feedId, body.enabled());
        return ResponseEntity.ok(Response.ok(toView(feed)));
    }

    private static SubscriberFeedAdminView toView(SubscriberFeed feed) {
        List<FormatView> formats = feed.getFormats() == null
                ? List.of()
                : feed.getFormats().stream()
                        .sorted(FormatView.DISPLAY_ORDER)
                        .map(FormatView::of)
                        .toList();
        return new SubscriberFeedAdminView(
                feed.getId(),
                feed.getUser().getId(),
                feed.getUser().getEmail(),
                feed.getTitle(),
                feed.isDefaultFeed(),
                feed.isEnabled(),
                formats.stream().map(FormatView::id).toList(),
                formats,
                feed.getCreatedAt(),
                feed.getUpdatedAt()
        );
    }

    public record SubscriberFeedAdminView(
            Long id,
            Long userId,
            String userEmail,
            String title,
            boolean isDefault,
            boolean enabled,
            List<Long> formatIds,
            List<FormatView> formats,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
