package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.service.TenantUserQueryService;
import de.pnnit.directwerk.modules.core.service.TenantUserQueryService.TenantUserView;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

    private final TenantUserQueryService tenantUserQueryService;
    private final SubscriptionService subscriptionService;

    public TenantSubscriberController(
            TenantUserQueryService tenantUserQueryService,
            SubscriptionService subscriptionService
    ) {
        this.tenantUserQueryService = tenantUserQueryService;
        this.subscriptionService = subscriptionService;
    }

    @GetMapping
    ResponseEntity<Response<List<SubscriberView>>> listSubscribers() {
        Long tenantId = TenantContext.requireTenantId();
        Map<Long, SubscriberViewBuilder> byUserId = new LinkedHashMap<>();

        for (TenantUserView user : tenantUserQueryService.listTenantUsers(tenantId)) {
            if (!user.roles().contains(Role.SUBSCRIBER.name())) {
                continue;
            }
            byUserId.put(
                    user.userId(),
                    new SubscriberViewBuilder(user.userId(), user.email(), user.name(), user.status())
            );
        }

        for (Subscription subscription : subscriptionService.listSubscriptionsForTenant(tenantId)) {
            Long userId = subscription.getUser().getId();
            SubscriberViewBuilder builder = byUserId.computeIfAbsent(
                    userId,
                    id -> new SubscriberViewBuilder(
                            id,
                            subscription.getUser().getEmail(),
                            subscription.getUser().getName(),
                            "ACTIVE"
                    )
            );
            builder.subscriptions.add(toSubscriptionSummary(subscription));
        }

        List<SubscriberView> subscribers = byUserId.values().stream()
                .map(SubscriberViewBuilder::build)
                .toList();
        return ResponseEntity.ok(Response.ok(subscribers));
    }

    private static SubscriptionSummary toSubscriptionSummary(Subscription subscription) {
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

    private static final class SubscriberViewBuilder {
        private final Long userId;
        private final String email;
        private final String name;
        private final String status;
        private final List<SubscriptionSummary> subscriptions = new ArrayList<>();

        private SubscriberViewBuilder(Long userId, String email, String name, String status) {
            this.userId = userId;
            this.email = email;
            this.name = name;
            this.status = status;
        }

        private SubscriberView build() {
            return new SubscriberView(userId, email, name, status, List.copyOf(subscriptions));
        }
    }

    public record SubscriberView(
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
}
