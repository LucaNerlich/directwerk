package de.pnnit.directwerk.modules.subscription.service;

import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.service.TenantUserQueryService;
import de.pnnit.directwerk.modules.core.service.TenantUserQueryService.TenantUserView;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read model for tenant subscriber directory (users with SUBSCRIBER role and/or active subscriptions).
 */
@Service
@RequiredArgsConstructor
public class SubscriberDirectoryQueryService {

    private final TenantUserQueryService tenantUserQueryService;
    private final SubscriptionService subscriptionService;

    @Transactional(readOnly = true)
    public List<SubscriberDirectoryEntry> listSubscribers(Long tenantId) {
        Map<Long, Builder> byUserId = new LinkedHashMap<>();

        for (TenantUserView user : tenantUserQueryService.listTenantUsers(tenantId)) {
            if (!user.roles().contains(Role.SUBSCRIBER.name())) {
                continue;
            }
            byUserId.put(
                    user.userId(),
                    new Builder(user.userId(), user.email(), user.name(), user.status())
            );
        }

        for (Subscription subscription : subscriptionService.listSubscriptionsForTenant(tenantId)) {
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

        return byUserId.values().stream()
                .map(Builder::build)
                .toList();
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
