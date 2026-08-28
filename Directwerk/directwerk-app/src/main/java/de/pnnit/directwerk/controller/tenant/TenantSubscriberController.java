package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.service.SubscriberDirectoryQueryService;
import de.pnnit.directwerk.modules.subscription.service.SubscriberDirectoryQueryService.SubscriberDirectoryEntry;
import de.pnnit.directwerk.modules.subscription.service.SubscriberDirectoryQueryService.SubscriptionSummary;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequiresModule(SubscriptionModule.MODULE_KEY)
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant/subscribers")
public class TenantSubscriberController {

    private final SubscriberDirectoryQueryService subscriberDirectoryQueryService;

    public TenantSubscriberController(SubscriberDirectoryQueryService subscriberDirectoryQueryService) {
        this.subscriberDirectoryQueryService = subscriberDirectoryQueryService;
    }

    @GetMapping
    ResponseEntity<Response<List<SubscriberView>>> listSubscribers() {
        Long tenantId = TenantContext.requireTenantId();
        List<SubscriberView> subscribers = subscriberDirectoryQueryService.listSubscribers(tenantId).stream()
                .map(TenantSubscriberController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(subscribers));
    }

    private static SubscriberView toView(SubscriberDirectoryEntry entry) {
        return new SubscriberView(
                entry.userId(),
                entry.email(),
                entry.name(),
                entry.status(),
                entry.subscriptions().stream()
                        .map(TenantSubscriberController::toSubscriptionSummary)
                        .toList()
        );
    }

    private static SubscriptionSummaryView toSubscriptionSummary(SubscriptionSummary summary) {
        return new SubscriptionSummaryView(
                summary.id(),
                summary.productId(),
                summary.productSlug(),
                summary.productTitle(),
                summary.status(),
                summary.source(),
                summary.startedAt(),
                summary.endsAt(),
                summary.externalSubscriptionId()
        );
    }

    public record SubscriberView(
            Long userId,
            String email,
            String name,
            String status,
            List<SubscriptionSummaryView> subscriptions
    ) {
    }

    public record SubscriptionSummaryView(
            Long id,
            Long productId,
            String productSlug,
            String productTitle,
            String status,
            String source,
            Instant startedAt,
            Instant endsAt,
            String externalSubscriptionId
    ) {
    }
}
