package de.pnnit.directwerk.modules.subscription.service;

import de.pnnit.directwerk.modules.subscription.service.EntitlementService.AccessSummary;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read model for subscriber entitlement summary (levels, packages, max level sort order).
 */
@Service
@RequiredArgsConstructor
public class SubscriberAccessQueryService {

    private final EntitlementService entitlementService;

    @Transactional(readOnly = true)
    public SubscriberAccessView resolveAccessView(Long tenantId, Long userId) {
        AccessSummary summary = entitlementService.resolveAccess(tenantId, userId);
        return new SubscriberAccessView(
                summary.activeLevels().stream()
                        .map(level -> new LevelView(level.id(), level.slug(), level.title(), level.sortOrder()))
                        .toList(),
                summary.maxLevelSortOrder(),
                summary.activePackages().stream()
                        .map(pkg -> new PackageView(pkg.id(), pkg.slug(), pkg.title()))
                        .toList()
        );
    }

    public record SubscriberAccessView(
            List<LevelView> activeLevels,
            Integer maxLevelSortOrder,
            List<PackageView> activePackages
    ) {
    }

    public record LevelView(Long id, String slug, String title, int sortOrder) {
    }

    public record PackageView(Long id, String slug, String title) {
    }
}
