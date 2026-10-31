package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.subscription.SubscriberEntitlementExplainService;
import de.pnnit.directwerk.subscription.SubscriberEntitlementExplainService.ContentCheckView;
import de.pnnit.directwerk.subscription.SubscriberEntitlementExplainService.MatchedRuleView;
import de.pnnit.directwerk.subscription.SubscriberEntitlementExplainService.SubjectSnapshotView;
import de.pnnit.directwerk.subscription.SubscriberEntitlementExplainService.SubscriberAccessExplainView;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService.LevelEntitlement;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService.PackageEntitlement;
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
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
    private final SubscriberEntitlementExplainService subscriberEntitlementExplainService;

    public TenantSubscriberController(
            SubscriberDirectoryQueryService subscriberDirectoryQueryService,
            SubscriberEntitlementExplainService subscriberEntitlementExplainService
    ) {
        this.subscriberDirectoryQueryService = subscriberDirectoryQueryService;
        this.subscriberEntitlementExplainService = subscriberEntitlementExplainService;
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

    /**
     * Entitlement summary for a subscriber, with optional episode/article access explanation.
     *
     * <p>Pass at most one of {@code episodeId} / {@code articleId}. When neither is set, returns
     * LEVEL max and active packages only (admin mirror of {@code GET /me/access} without roles).
     */
    @GetMapping("/{userId}/access")
    ResponseEntity<Response<SubscriberAccessView>> subscriberAccess(
            @PathVariable Long userId,
            @RequestParam(required = false) Long episodeId,
            @RequestParam(required = false) Long articleId
    ) {
        if (episodeId != null && articleId != null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Response.error(
                            400,
                            "INVALID_CONTENT_CHECK",
                            "Provide either episodeId or articleId, not both"
                    ));
        }
        Long tenantId = TenantContext.requireTenantId();
        return subscriberEntitlementExplainService
                .explain(tenantId, userId, episodeId, articleId)
                .map(TenantSubscriberController::toAccessView)
                .map(view -> ResponseEntity.ok(Response.ok(view)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Response.error(404, "USER_NOT_FOUND", "User not found")));
    }

    private static SubscriberAccessView toAccessView(SubscriberAccessExplainView explain) {
        return new SubscriberAccessView(
                explain.userId(),
                explain.activeLevels().stream()
                        .map(TenantSubscriberController::toLevelView)
                        .toList(),
                explain.maxLevelSortOrder(),
                explain.activePackages().stream()
                        .map(TenantSubscriberController::toPackageView)
                        .toList(),
                explain.check() == null ? null : toCheckView(explain.check())
        );
    }

    private static LevelView toLevelView(LevelEntitlement level) {
        return new LevelView(level.id(), level.slug(), level.title(), level.sortOrder());
    }

    private static PackageView toPackageView(PackageEntitlement pkg) {
        return new PackageView(pkg.id(), pkg.slug(), pkg.title());
    }

    private static ContentCheckApiView toCheckView(ContentCheckView check) {
        return new ContentCheckApiView(
                check.kind(),
                check.id(),
                check.title(),
                check.slug(),
                check.allowed(),
                check.reason(),
                check.subject() == null ? null : toSubjectView(check.subject()),
                check.matchedRules().stream().map(TenantSubscriberController::toMatchedRuleView).toList()
        );
    }

    private static SubjectSnapshotApiView toSubjectView(SubjectSnapshotView subject) {
        return new SubjectSnapshotApiView(
                subject.free(),
                subject.requiredLevelSortOrder(),
                subject.maxFormatRequiredLevel(),
                subject.seriesId(),
                subject.formatIds(),
                subject.categoryIds()
        );
    }

    private static MatchedRuleApiView toMatchedRuleView(MatchedRuleView rule) {
        return new MatchedRuleApiView(
                rule.ruleId(),
                rule.productId(),
                rule.productSlug(),
                rule.productTitle(),
                rule.scopeType(),
                rule.scopeId()
        );
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

    public record SubscriberAccessView(
            Long userId,
            List<LevelView> activeLevels,
            Integer maxLevelSortOrder,
            List<PackageView> activePackages,
            ContentCheckApiView check
    ) {
    }

    public record LevelView(Long id, String slug, String title, int sortOrder) {
    }

    public record PackageView(Long id, String slug, String title) {
    }

    public record ContentCheckApiView(
            String kind,
            Long id,
            String title,
            String slug,
            boolean allowed,
            String reason,
            SubjectSnapshotApiView subject,
            List<MatchedRuleApiView> matchedRules
    ) {
    }

    public record SubjectSnapshotApiView(
            boolean free,
            int requiredLevelSortOrder,
            Integer maxFormatRequiredLevel,
            Long seriesId,
            Set<Long> formatIds,
            Set<Long> categoryIds
    ) {
    }

    public record MatchedRuleApiView(
            Long ruleId,
            Long productId,
            String productSlug,
            String productTitle,
            String scopeType,
            Long scopeId
    ) {
    }
}
