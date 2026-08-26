package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.api.dto.DomainView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.TenantDomainService;
import de.pnnit.directwerk.modules.core.service.TenantManagementService;
import de.pnnit.directwerk.modules.core.service.TenantInvitationService;
import de.pnnit.directwerk.modules.core.service.TenantManagementService.TenantCreationResult;
import de.pnnit.directwerk.modules.core.service.TenantManagementService.TenantDetailView;
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

    private final TenantRepository tenantRepository;
    private final TenantManagementService tenantManagementService;
    private final TenantDomainService tenantDomainService;
    private final DirectwerkConfig directwerkConfig;

    /**
     * Creates a controller for platform tenant lifecycle endpoints.
     *
     * @param tenantRepository         repository used to retrieve tenants
     * @param tenantManagementService service used to manage tenant lifecycle operations
     * @param tenantDomainService      service used for platform domain operations
     * @param directwerkConfig         configuration controlling development token exposure
     */
    public PlatformTenantController(
            TenantRepository tenantRepository,
            TenantManagementService tenantManagementService,
            TenantDomainService tenantDomainService,
            DirectwerkConfig directwerkConfig
    ) {
        this.tenantRepository = tenantRepository;
        this.tenantManagementService = tenantManagementService;
        this.tenantDomainService = tenantDomainService;
        this.directwerkConfig = directwerkConfig;
    }

    /**
     * Lists all tenants.
     *
     * @return the tenant list response
     */
    @GetMapping
    ResponseEntity<Response<TenantListResponse>> listTenants() {
        List<TenantView> tenants = tenantRepository.findAll().stream()
                .map(this::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(new TenantListResponse(tenants)));
    }

    /**
     * Creates a tenant and includes administrator invitation details when available.
     *
     * @param request validated tenant and administrator details
     * @return the created tenant and invitation details, or a conflict response when the tenant slug already exists
     */
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

    /**
     * Retrieves detailed information for a tenant.
     *
     * @param tenantId the tenant identifier
     * @return the tenant details
     */
    @GetMapping("/{tenantId}")
    ResponseEntity<Response<TenantDetailView>> getTenant(@PathVariable Long tenantId) {
        return ResponseEntity.ok(Response.ok(tenantManagementService.getTenant(tenantId)));
    }

    /**
     * Updates a tenant's name and slug.
     *
     * @param tenantId the identifier of the tenant to update
     * @param request the requested tenant name and slug
     * @return the updated tenant details, or a conflict response when the slug already exists
     */
    @PatchMapping("/{tenantId}")
    ResponseEntity<Response<TenantDetailView>> updateTenant(
            @PathVariable Long tenantId,
            @Valid @RequestBody UpdateTenantRequest request
    ) {
                return ResponseEntity.ok(Response.ok(
                tenantManagementService.updateTenant(tenantId, request.name(), request.slug())
        ));
    }

    /**
     * Suspends the specified tenant.
     *
     * @param tenantId the ID of the tenant to suspend
     * @return the suspended tenant details
     */
    @PostMapping("/{tenantId}/suspend")
    ResponseEntity<Response<TenantDetailView>> suspendTenant(@PathVariable Long tenantId) {
        return ResponseEntity.ok(Response.ok(tenantManagementService.suspendTenant(tenantId)));
    }

    /**
     * Reactivates a suspended tenant.
     *
     * @param tenantId the identifier of the tenant to reactivate
     * @return the reactivated tenant details
     */
    @PostMapping("/{tenantId}/reactivate")
    ResponseEntity<Response<TenantDetailView>> reactivateTenant(@PathVariable Long tenantId) {
        return ResponseEntity.ok(Response.ok(tenantManagementService.reactivateTenant(tenantId)));
    }

    /**
     * Forces verification of a tenant domain.
     *
     * @param tenantId the tenant identifier
     * @param host     the domain host to verify
     * @return         the verified domain details
     */
    @PostMapping("/{tenantId}/domains/{host:.+}/verify")
    ResponseEntity<Response<DomainView>> forceVerifyDomain(
            @PathVariable Long tenantId,
            @PathVariable String host
    ) {
        TenantDomain domain = tenantDomainService.forceVerifyDomain(tenantId, host);
        return ResponseEntity.ok(Response.ok(new DomainView(domain.getHost(), domain.isPrimary(), domain.isVerified())));
    }

    /**
     * Converts a tenant entity into its API view representation.
     *
     * @param tenant the tenant to convert
     * @return the tenant view
     */
    private TenantView toView(Tenant tenant) {
        return new TenantView(tenant.getId(), tenant.getSlug(), tenant.getName(), tenant.getStatus().name());
    }

    public record TenantListResponse(List<TenantView> content) {
    }

    public record TenantView(Long id, String slug, String name, String status) {
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
