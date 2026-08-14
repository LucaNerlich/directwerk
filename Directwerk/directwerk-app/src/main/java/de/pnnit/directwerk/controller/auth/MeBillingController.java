package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.subscription.stripe.StripeCheckoutService;
import de.pnnit.directwerk.modules.subscription.stripe.StripeCustomerPortalService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@PreAuthorize("hasRole('SUBSCRIBER') or hasRole('TENANT_ADMIN') or hasRole('EDITOR')")
@RequestMapping("/api/v1/me/billing")
public class MeBillingController {

    private final StripeCheckoutService stripeCheckoutService;
    private final StripeCustomerPortalService stripeCustomerPortalService;

    public MeBillingController(
            StripeCheckoutService stripeCheckoutService,
            StripeCustomerPortalService stripeCustomerPortalService
    ) {
        this.stripeCheckoutService = stripeCheckoutService;
        this.stripeCustomerPortalService = stripeCustomerPortalService;
    }

    @PostMapping("/checkout-sessions")
    ResponseEntity<Response<CheckoutSessionView>> createCheckoutSession(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @Valid @RequestBody CheckoutSessionRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        String url = stripeCheckoutService.createCheckoutSession(
                user.tenantId(),
                user.userId(),
                request.productSlug(),
                request.successUrl(),
                request.cancelUrl()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(new CheckoutSessionView(url)));
    }

    @PostMapping("/portal")
    ResponseEntity<Response<CheckoutSessionView>> createPortalSession(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            @Valid @RequestBody(required = false) PortalRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        String url = stripeCustomerPortalService.createPortalSession(
                user.tenantId(),
                user.userId(),
                request != null ? request.returnUrl() : null
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(new CheckoutSessionView(url)));
    }

    public record CheckoutSessionRequest(
            @NotBlank @Size(max = 128) String productSlug,
            @Size(max = 2048) String successUrl,
            @Size(max = 2048) String cancelUrl
    ) {
    }

    public record PortalRequest(@Size(max = 2048) String returnUrl) {
    }

    public record CheckoutSessionView(String url) {
    }
}
