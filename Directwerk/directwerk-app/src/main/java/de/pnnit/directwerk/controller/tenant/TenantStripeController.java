package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.subscription.StripeBillingModule;
import de.pnnit.directwerk.modules.subscription.stripe.BillingRedirectUrlValidator;
import de.pnnit.directwerk.modules.subscription.stripe.StripeConnectService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant/stripe")
public class TenantStripeController {

    private final StripeConnectService stripeConnectService;
    private final BillingRedirectUrlValidator redirectUrlValidator;

    public TenantStripeController(
            StripeConnectService stripeConnectService,
            BillingRedirectUrlValidator redirectUrlValidator
    ) {
        this.stripeConnectService = stripeConnectService;
        this.redirectUrlValidator = redirectUrlValidator;
    }

    @GetMapping("/status")
    ResponseEntity<Response<StripeStatusView>> status() {
        Long tenantId = TenantContext.requireTenantId();
        StripeConnectService.StripeStatusSnapshot snapshot = stripeConnectService.status(tenantId);
        return ResponseEntity.ok(Response.ok(toView(snapshot)));
    }

    @PostMapping("/onboard")
    @RequiresModule(StripeBillingModule.KEY)
    ResponseEntity<Response<OnboardView>> onboard(@Valid @RequestBody(required = false) OnboardRequest request) {
        Long tenantId = TenantContext.requireTenantId();
        String returnUrl = request != null && request.returnUrl() != null
                ? request.returnUrl()
                : redirectUrlValidator.defaultStudioUrl("/settings/stripe?onboard=return");
        String refreshUrl = request != null && request.refreshUrl() != null
                ? request.refreshUrl()
                : redirectUrlValidator.defaultStudioUrl("/settings/stripe?onboard=refresh");
        String url = stripeConnectService.createOnboardLink(tenantId, returnUrl, refreshUrl);
        return ResponseEntity.ok(Response.ok(new OnboardView(url)));
    }

    private static StripeStatusView toView(StripeConnectService.StripeStatusSnapshot snapshot) {
        return new StripeStatusView(
                snapshot.status(),
                snapshot.moduleEnabled(),
                snapshot.message(),
                snapshot.chargesEnabled(),
                snapshot.payoutsEnabled(),
                snapshot.detailsSubmitted()
        );
    }

    public record OnboardRequest(
            @Size(max = 2048) String returnUrl,
            @Size(max = 2048) String refreshUrl
    ) {
    }

    public record OnboardView(String url) {
    }

    public record StripeStatusView(
            String status,
            boolean moduleEnabled,
            String message,
            boolean chargesEnabled,
            boolean payoutsEnabled,
            boolean detailsSubmitted
    ) {
    }
}
