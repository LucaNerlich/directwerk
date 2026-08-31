package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.api.dto.DomainView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.service.TenantDomainService;
import de.pnnit.directwerk.modules.core.service.TenantInvitationService;
import de.pnnit.directwerk.modules.core.service.TenantManagementService;
import de.pnnit.directwerk.modules.core.service.TenantManagementService.TenantCreationResult;
import de.pnnit.directwerk.modules.core.service.TenantManagementService.TenantDetailView;
import de.pnnit.directwerk.modules.core.service.TenantManagementService.TenantListItemView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequestMapping("/api/v1/platform/tenants")
public class PlatformTenantController {

    private final TenantManagementService tenantManagementService;
    private final TenantDomainService tenantDomainService;
    private final DirectwerkConfig directwerkConfig;
    private final PlatformTenantStatsService platformTenantStatsService;

    public PlatformTenantController(
            TenantManagementService tenantManagementService,
            TenantDomainService tenantDomainService,
            DirectwerkConfig directwerkConfig,
            PlatformTenantStatsService platformTenantStatsService
    ) {
        this.tenantManagementService = tenantManagementService;
        this.tenantDomainService = tenantDomainService;
        this.directwerkConfig = directwerkConfig;
        this.platformTenantStatsService = platformTenantStatsService;
    }

    @GetMapping
    ResponseEntity<Response<TenantListResponse>> listTenants() {
        List<TenantListItemView> tenants = tenantManagementService.listTenants();
        return ResponseEntity.ok(Response.ok(new TenantListResponse(tenants)));
    }

    @PostMapping
    ResponseEntity<Response<TenantCreationResponse>> createTenant(@Valid @RequestBody CreateTenantRequest request) {
                TenantCreationResult result = tenantManagementService.createTenant(
                request.name(),
                request.slug(),
                request.primaryDomain(),
                request.modulePreset(),
                request.adminEmail(),
                request.adminName()
        );
        TenantDetailView tenant = result.tenant();
        TenantInvitationService.InvitationResult invitation = result.adminInvitation();
        AdminInvitationResponse adminInvitation = invitation == null
                ? null
                : new AdminInvitationResponse(
                        invitation.email(),
                        invitation.status(),
                        directwerkConfig.isExposeDevTokens() ? invitation.inviteToken() : null
                );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(
                new TenantCreationResponse(
                        tenant.id(),
                        tenant.slug(),
                        tenant.name(),
                        tenant.status(),
                        adminInvitation
                )
        ));
    }

    @GetMapping("/{tenantId}")
    ResponseEntity<Response<TenantDetailResponse>> getTenant(@PathVariable Long tenantId) {
        TenantDetailView tenant = tenantManagementService.getTenant(tenantId);
        PlatformTenantStatsService.TenantStatsView stats = platformTenantStatsService.statsFor(tenantId);
        return ResponseEntity.ok(Response.ok(new TenantDetailResponse(tenant, stats.episodeCount(), stats.subscriberCount())));
    }

    @PatchMapping("/{tenantId}")
    ResponseEntity<Response<TenantDetailView>> updateTenant(
            @PathVariable Long tenantId,
            @Valid @RequestBody UpdateTenantRequest request
    ) {
                return ResponseEntity.ok(Response.ok(
                tenantManagementService.updateTenant(tenantId, request.name(), request.slug())
        ));
    }

    @PostMapping("/{tenantId}/suspend")
    ResponseEntity<Response<TenantDetailView>> suspendTenant(@PathVariable Long tenantId) {
        return ResponseEntity.ok(Response.ok(tenantManagementService.suspendTenant(tenantId)));
    }

    @PostMapping("/{tenantId}/reactivate")
    ResponseEntity<Response<TenantDetailView>> reactivateTenant(@PathVariable Long tenantId) {
        return ResponseEntity.ok(Response.ok(tenantManagementService.reactivateTenant(tenantId)));
    }

    @PostMapping("/{tenantId}/domains/{host:.+}/verify")
    ResponseEntity<Response<DomainView>> forceVerifyDomain(
            @PathVariable Long tenantId,
            @PathVariable String host
    ) {
        TenantDomain domain = tenantDomainService.forceVerifyDomain(tenantId, host);
        return ResponseEntity.ok(Response.ok(new DomainView(domain.getHost(), domain.isPrimary(), domain.isVerified())));
    }

    public record TenantListResponse(List<TenantListItemView> content) {
    }

    public record TenantDetailResponse(
            TenantDetailView tenant,
            long episodeCount,
            long subscriberCount
    ) {
    }

    public record CreateTenantRequest(
            @NotBlank String name,
            @NotBlank
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            String primaryDomain,
            String modulePreset,
            @Email String adminEmail,
            @Size(max = 255) String adminName
    ) {
    }

    public record UpdateTenantRequest(
            @Size(max = 255) String name,
            @Pattern(regexp = "^$|^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug
    ) {
    }

    public record TenantCreationResponse(
            Long id,
            String slug,
            String name,
            String status,
            AdminInvitationResponse adminInvitation
    ) {
    }

    public record AdminInvitationResponse(String email, String status, String inviteToken) {
    }
}
