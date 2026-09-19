package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.AnalyticsModule;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.email.EmailNotifyModule;
import de.pnnit.directwerk.modules.email.content.TenantContentEmailTemplateService;
import de.pnnit.directwerk.modules.email.esp.TenantEspConnectionService;
import de.pnnit.directwerk.modules.stripebilling.StripeBillingModule;
import de.pnnit.directwerk.modules.stripebilling.StripeConnectService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant/integrations")
public class TenantIntegrationsController {

    private final ModuleGateService moduleGateService;
    private final DirectwerkConfig directwerkConfig;
    private final TenantEspConnectionService tenantEspConnectionService;
    private final TenantContentEmailTemplateService tenantContentEmailTemplateService;
    private final StripeConnectService stripeConnectService;

    public TenantIntegrationsController(
            ModuleGateService moduleGateService,
            DirectwerkConfig directwerkConfig,
            TenantEspConnectionService tenantEspConnectionService,
            TenantContentEmailTemplateService tenantContentEmailTemplateService,
            StripeConnectService stripeConnectService
    ) {
        this.moduleGateService = moduleGateService;
        this.directwerkConfig = directwerkConfig;
        this.tenantEspConnectionService = tenantEspConnectionService;
        this.tenantContentEmailTemplateService = tenantContentEmailTemplateService;
        this.stripeConnectService = stripeConnectService;
    }

    @GetMapping("/status")
    ResponseEntity<Response<IntegrationsStatusView>> status() {
        Long tenantId = TenantContext.requireTenantId();
        boolean emailNotify = moduleGateService.isModuleActive(tenantId, EmailNotifyModule.KEY);
        boolean analytics = moduleGateService.isModuleActive(tenantId, AnalyticsModule.KEY);
        boolean stripeModule = moduleGateService.isModuleActive(tenantId, StripeBillingModule.KEY);
        long templateCount = tenantContentEmailTemplateService.countForTenant(tenantId);
        var esp = tenantEspConnectionService.find(tenantId)
                .map(TenantEspConnectionService::toView)
                .orElse(null);
        StripeConnectService.StripeStatusSnapshot stripe = stripeConnectService.status(tenantId);
        return ResponseEntity.ok(Response.ok(new IntegrationsStatusView(
                new EmailNotifyStatusView(
                        emailNotify,
                        directwerkConfig.isEmailEnabled() && directwerkConfig.email().isDeliveryReady(),
                        directwerkConfig.email().provider(),
                        templateCount,
                        esp
                ),
                new AnalyticsStatusView(analytics),
                new StripeStatusSnapshotView(
                        stripe.status(),
                        stripeModule,
                        stripe.message(),
                        stripe.chargesEnabled(),
                        stripe.payoutsEnabled(),
                        stripe.detailsSubmitted()
                )
        )));
    }

    @GetMapping("/esp")
    ResponseEntity<Response<TenantEspConnectionService.EspConnectionView>> getEsp() {
        Long tenantId = TenantContext.requireTenantId();
        return tenantEspConnectionService.find(tenantId)
                .map(connection -> ResponseEntity.ok(Response.ok(TenantEspConnectionService.toView(connection))))
                .orElseGet(() -> ResponseEntity.ok(Response.ok(null)));
    }

    @PutMapping("/esp/mailgun")
    ResponseEntity<Response<TenantEspConnectionService.EspConnectionView>> connectMailgun(
            @Valid @RequestBody ConnectMailgunRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        var saved = tenantEspConnectionService.upsertMailgun(
                tenantId,
                request.domain(),
                request.fromEmail(),
                request.fromName(),
                request.region(),
                request.apiKey()
        );
        return ResponseEntity.status(HttpStatus.OK).body(Response.ok(TenantEspConnectionService.toView(saved)));
    }

    @DeleteMapping("/esp")
    ResponseEntity<Void> disconnectEsp() {
        Long tenantId = TenantContext.requireTenantId();
        tenantEspConnectionService.disconnect(tenantId);
        return ResponseEntity.noContent().build();
    }

    public record ConnectMailgunRequest(
            @NotBlank @Size(max = 255) String domain,
            @NotBlank @Email @Size(max = 320) String fromEmail,
            @Size(max = 255) String fromName,
            @Pattern(regexp = "EU|US|eu|us") String region,
            @NotBlank @Size(max = 512) String apiKey
    ) {
    }

    public record IntegrationsStatusView(
            EmailNotifyStatusView emailNotify,
            AnalyticsStatusView analytics,
            StripeStatusSnapshotView stripe
    ) {
    }

    public record EmailNotifyStatusView(
            boolean moduleEnabled,
            boolean platformSenderReady,
            String platformProvider,
            long customTemplateCount,
            TenantEspConnectionService.EspConnectionView mailgun
    ) {
    }

    public record AnalyticsStatusView(boolean moduleEnabled) {
    }

    public record StripeStatusSnapshotView(
            String status,
            boolean moduleEnabled,
            String message,
            boolean chargesEnabled,
            boolean payoutsEnabled,
            boolean detailsSubmitted
    ) {
    }
}
