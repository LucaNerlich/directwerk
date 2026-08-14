package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PreAuthorize("isAuthenticated()")
@RequestMapping("/api/v1/me")
public class MeController {

    private final UserRepository userRepository;
    private final EntitlementService entitlementService;
    private final SubscriptionService subscriptionService;

    public MeController(
            UserRepository userRepository,
            EntitlementService entitlementService,
            SubscriptionService subscriptionService
    ) {
        this.userRepository = userRepository;
        this.entitlementService = entitlementService;
        this.subscriptionService = subscriptionService;
    }

    @GetMapping
    ResponseEntity<Response<MeResponse>> me(@AuthenticationPrincipal DirectwerkUserPrincipal principal) {
        // Tenant membership already validated via SecurityContext + Host by tenant filters.
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        return userRepository.findById(user.userId())
                .map(account -> ResponseEntity.ok(Response.ok(new MeResponse(
                        account.getEmail(),
                        account.getName(),
                        user.roleNames(),
                        user.tenantId()
                ))))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Response.error(404, "USER_NOT_FOUND", "User not found")));
    }

    @GetMapping("/access")
    ResponseEntity<Response<AccessResponse>> access(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        Long tenantId = user.tenantId();

        return userRepository.findById(user.userId())
                .map(account -> {
                    EntitlementService.AccessSummary summary = entitlementService.resolveAccess(
                            tenantId,
                            account.getId()
                    );
                    List<LevelView> levels = summary.activeLevels().stream()
                            .map(level -> new LevelView(level.id(), level.slug(), level.title(), level.sortOrder()))
                            .toList();
                    List<PackageView> packages = summary.activePackages().stream()
                            .map(packageEntitlement -> new PackageView(
                                    packageEntitlement.id(),
                                    packageEntitlement.slug(),
                                    packageEntitlement.title()
                            ))
                            .toList();
                    return ResponseEntity.ok(Response.ok(new AccessResponse(
                            levels,
                            summary.maxLevelSortOrder(),
                            packages,
                            user.roleNames(),
                            tenantId
                    )));
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Response.error(404, "USER_NOT_FOUND", "User not found")));
    }

    @GetMapping("/subscriptions")
    ResponseEntity<Response<List<SubscriptionView>>> subscriptions(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        List<SubscriptionView> subscriptions = subscriptionService
                .listSubscriptionsForUser(user.tenantId(), user.userId())
                .stream()
                .map(MeController::toSubscriptionView)
                .toList();
        return ResponseEntity.ok(Response.ok(subscriptions));
    }

    private static SubscriptionView toSubscriptionView(Subscription subscription) {
        SubscriptionProduct product = subscription.getProduct();
        return new SubscriptionView(
                subscription.getId(),
                product.getId(),
                product.getSlug(),
                product.getTitle(),
                product.getOfferingType().name(),
                subscription.getStatus().name(),
                subscription.getSource().name(),
                subscription.getStartedAt(),
                subscription.getEndsAt()
        );
    }

    public record MeResponse(String email, String name, List<String> roles, Long tenantId) {
    }

    public record AccessResponse(
            List<LevelView> activeLevels,
            Integer maxLevelSortOrder,
            List<PackageView> activePackages,
            List<String> roles,
            Long tenantId
    ) {
    }

    public record LevelView(Long id, String slug, String title, int sortOrder) {
    }

    public record PackageView(Long id, String slug, String title) {
    }

    public record SubscriptionView(
            Long id,
            Long productId,
            String productSlug,
            String productTitle,
            String offeringType,
            String status,
            String source,
            java.time.Instant startedAt,
            java.time.Instant endsAt
    ) {
    }
}
