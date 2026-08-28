package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant/subscriptions")
public class TenantSubscriptionController {

    private final SubscriptionService subscriptionService;

    public TenantSubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @PostMapping
    ResponseEntity<Response<SubscriptionView>> grantSubscription(@Valid @RequestBody GrantSubscriptionRequest request) {
        Long tenantId = TenantContext.requireTenantId();
        Subscription subscription = subscriptionService.grantManualSubscription(
                tenantId,
                request.email(),
                request.productId()
        );
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Response.created(toView(subscription)));
    }

    @DeleteMapping("/{subscriptionId}")
    ResponseEntity<Response<SubscriptionView>> revokeSubscription(
            @PathVariable @Positive Long subscriptionId
    ) {
        Long tenantId = TenantContext.requireTenantId();
        Subscription subscription = subscriptionService.revokeSubscription(tenantId, subscriptionId);
        return ResponseEntity.ok(Response.ok(toView(subscription)));
    }

    private static SubscriptionView toView(Subscription subscription) {
        SubscriptionProduct product = subscription.getProduct();
        return new SubscriptionView(
                subscription.getId(),
                subscription.getUser().getId(),
                subscription.getUser().getEmail(),
                product.getId(),
                product.getSlug(),
                product.getTitle(),
                subscription.getStatus().name(),
                subscription.getSource().name()
        );
    }

    public record GrantSubscriptionRequest(
            @NotBlank @Email String email,
            @NotNull @Positive Long productId
    ) {
    }

    public record SubscriptionView(
            Long id,
            Long userId,
            String email,
            Long productId,
            String productSlug,
            String productTitle,
            String status,
            String source
    ) {
    }
}
