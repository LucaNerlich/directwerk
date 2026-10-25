package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.service.SubscriberDirectoryQueryService;
import de.pnnit.directwerk.modules.subscription.service.SubscriberDirectoryQueryService.SubscriberDirectoryEntry;
import de.pnnit.directwerk.modules.subscription.service.SubscriberDirectoryQueryService.SubscriberDirectoryPage;
import de.pnnit.directwerk.modules.subscription.service.SubscriberDirectoryQueryService.SubscriptionSummary;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    /**
     * Lists one page of the subscriber directory (#561).
     *
     * <p>Rows are the union of role-SUBSCRIBER members and subscription owners; paging is
     * applied at the id-level union, not on a single repository.
     *
     * @param page zero-based page index
     * @param size page size, 1-100
     * @param q    optional case-insensitive email/name/product-title search
     */
    @GetMapping
    ResponseEntity<Response<List<SubscriberView>>> listSubscribers(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int size,
            @RequestParam(required = false) @Size(max = 100) String q
    ) {
        Long tenantId = TenantContext.requireTenantId();
        SubscriberDirectoryPage directoryPage =
                subscriberDirectoryQueryService.listSubscribers(tenantId, page, size, q);
        List<SubscriberView> subscribers = directoryPage.content().stream()
                .map(TenantSubscriberController::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(
                subscribers,
                Map.of(
                        "page", directoryPage.page(),
                        "size", directoryPage.size(),
                        "totalElements", directoryPage.totalElements()
                )
        ));
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
