package de.pnnit.directwerk.modules.subscription.service;

import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.repository.SubscriberDirectoryRepository;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Read model for tenant subscriber directory (users with SUBSCRIBER role and/or subscriptions).
 *
 * <p>#561: pages at the id-level union of role-SUBSCRIBER members and subscription owners,
 * then hydrates only that page — not a {@code Pageable} on one repository.
 */
@Service
@RequiredArgsConstructor
public class SubscriberDirectoryQueryService {

    /** Upper bound on the directory page size, mirroring the controller's {@code @Max}. */
    private static final int MAX_SUBSCRIBER_PAGE_SIZE = 100;

    private final TenantRepository tenantRepository;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final SubscriberDirectoryRepository subscriberDirectoryRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final ModuleGateService moduleGateService;

    /**
     * Issue #311: the subscriber population size without hydrating directory rows.
     * Mirrors {@link #listSubscribers(Long, int, int, String)} inclusion rules (no search).
     */
    @Transactional(readOnly = true)
    public long countSubscribers(Long tenantId) {
        tenantRepository.requireById(tenantId);
        boolean includeSubscriptions =
                moduleGateService.isModuleActive(tenantId, SubscriptionModule.MODULE_KEY);
        return subscriberDirectoryRepository.countSubscriberUserIds(
                tenantId,
                includeSubscriptions,
                true,
                "%"
        );
    }

    /**
     * Unbounded directory — prefer {@link #listSubscribers(Long, int, int, String)} for UIs.
     */
    @Transactional(readOnly = true)
    public List<SubscriberDirectoryEntry> listSubscribers(Long tenantId) {
        return listSubscribers(tenantId, 0, MAX_SUBSCRIBER_PAGE_SIZE, null).content();
    }

    /**
     * One page of the subscriber directory, optionally filtered by email/name/product title.
     *
     * @param page  zero-based page index
     * @param size  requested page size, clamped to {@link #MAX_SUBSCRIBER_PAGE_SIZE}
     * @param query optional case-insensitive search; blank means no filter
     */
    @Transactional(readOnly = true)
    public SubscriberDirectoryPage listSubscribers(Long tenantId, int page, int size, String query) {
        tenantRepository.requireById(tenantId);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_SUBSCRIBER_PAGE_SIZE);
        String trimmed = query == null ? "" : query.trim();
        boolean queryBlank = !StringUtils.hasText(trimmed);
        // Same unescaped LIKE pattern style as TenantManagementService.search (#551).
        String pattern = queryBlank ? "%" : "%" + trimmed + "%";
        boolean includeSubscriptions =
                moduleGateService.isModuleActive(tenantId, SubscriptionModule.MODULE_KEY);

        long total = subscriberDirectoryRepository.countSubscriberUserIds(
                tenantId,
                includeSubscriptions,
                queryBlank,
                pattern
        );
        if (total == 0) {
            return new SubscriberDirectoryPage(List.of(), 0, safePage, safeSize);
        }

        List<Long> userIds = subscriberDirectoryRepository.findSubscriberUserIds(
                tenantId,
                includeSubscriptions,
                queryBlank,
                pattern,
                safePage * safeSize,
                safeSize
        );
        if (userIds.isEmpty()) {
            return new SubscriberDirectoryPage(List.of(), total, safePage, safeSize);
        }

        Map<Long, TenantMembership> membershipByUserId = tenantMembershipRepository
                .findByTenantIdAndUserIdIn(tenantId, userIds)
                .stream()
                .collect(Collectors.toMap(
                        membership -> membership.getUser().getId(),
                        Function.identity(),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        Map<Long, Builder> byUserId = new LinkedHashMap<>();
        for (Long userId : userIds) {
            TenantMembership membership = membershipByUserId.get(userId);
            if (membership == null) {
                continue;
            }
            byUserId.put(
                    userId,
                    new Builder(
                            userId,
                            membership.getUser().getEmail(),
                            membership.getUser().getName(),
                            membership.getStatus().name()
                    )
            );
        }

        if (includeSubscriptions) {
            for (Subscription subscription :
                    subscriptionRepository.findDetailedByTenantIdAndUserIdIn(tenantId, userIds)) {
                Long userId = subscription.getUser().getId();
                Builder builder = byUserId.computeIfAbsent(
                        userId,
                        id -> new Builder(
                                id,
                                subscription.getUser().getEmail(),
                                subscription.getUser().getName(),
                                "ACTIVE"
                        )
                );
                builder.subscriptions.add(toSummary(subscription));
            }
        }

        List<SubscriberDirectoryEntry> content = userIds.stream()
                .map(byUserId::get)
                .filter(builder -> builder != null)
                .map(Builder::build)
                .toList();
        return new SubscriberDirectoryPage(content, total, safePage, safeSize);
    }

    private static SubscriptionSummary toSummary(Subscription subscription) {
        SubscriptionProduct product = subscription.getProduct();
        return new SubscriptionSummary(
                subscription.getId(),
                product.getId(),
                product.getSlug(),
                product.getTitle(),
                subscription.getStatus().name(),
                subscription.getSource().name(),
                subscription.getStartedAt(),
                subscription.getEndsAt(),
                subscription.getExternalSubscriptionId()
        );
    }

    public record SubscriberDirectoryPage(
            List<SubscriberDirectoryEntry> content,
            long totalElements,
            int page,
            int size
    ) {
    }

    public record SubscriberDirectoryEntry(
            Long userId,
            String email,
            String name,
            String status,
            List<SubscriptionSummary> subscriptions
    ) {
    }

    public record SubscriptionSummary(
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

    private static final class Builder {
        private final Long userId;
        private final String email;
        private final String name;
        private final String status;
        private final List<SubscriptionSummary> subscriptions = new ArrayList<>();

        private Builder(Long userId, String email, String name, String status) {
            this.userId = userId;
            this.email = email;
            this.name = name;
            this.status = status;
        }

        private SubscriberDirectoryEntry build() {
            return new SubscriberDirectoryEntry(userId, email, name, status, List.copyOf(subscriptions));
        }
    }
}
