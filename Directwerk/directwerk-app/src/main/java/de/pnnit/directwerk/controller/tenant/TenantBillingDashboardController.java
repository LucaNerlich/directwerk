package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.stripe.BillingDashboardService;
import de.pnnit.directwerk.multitenancy.TenantContext;
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
@RequestMapping("/api/v1/tenant/billing")
public class TenantBillingDashboardController {

    private final BillingDashboardService billingDashboardService;

    public TenantBillingDashboardController(BillingDashboardService billingDashboardService) {
        this.billingDashboardService = billingDashboardService;
    }

    @GetMapping("/dashboard")
    ResponseEntity<Response<BillingDashboardService.BillingDashboard>> dashboard() {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(billingDashboardService.snapshot(tenantId)));
    }
}
