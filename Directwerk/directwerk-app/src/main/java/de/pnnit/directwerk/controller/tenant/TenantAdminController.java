package de.pnnit.directwerk.controller.tenant;

import de.pnnit.directwerk.api.dto.DomainView;
import de.pnnit.directwerk.api.dto.InvitationResponseMapper;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.core.service.TenantDomainService;
import de.pnnit.directwerk.modules.core.service.TenantInvitationService;
import de.pnnit.directwerk.modules.core.service.TenantMembershipManagementService;
import de.pnnit.directwerk.modules.core.service.TenantUserQueryService;
import de.pnnit.directwerk.modules.core.service.TenantUserQueryService.TenantUserView;
import de.pnnit.directwerk.multitenancy.TenantContext;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PreAuthorize("hasRole('TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant")
public class TenantAdminController {

    private final TenantBrandingService tenantBrandingService;
    private final TenantDomainService tenantDomainService;
    private final TenantInvitationService tenantInvitationService;
    private final TenantUserQueryService tenantUserQueryService;
    private final TenantMembershipManagementService tenantMembershipManagementService;
    private final InvitationResponseMapper invitationResponseMapper;

    public TenantAdminController(
            TenantBrandingService tenantBrandingService,
            TenantDomainService tenantDomainService,
            TenantInvitationService tenantInvitationService,
            TenantUserQueryService tenantUserQueryService,
            TenantMembershipManagementService tenantMembershipManagementService,
            InvitationResponseMapper invitationResponseMapper
    ) {
        this.tenantBrandingService = tenantBrandingService;
        this.tenantDomainService = tenantDomainService;
        this.tenantInvitationService = tenantInvitationService;
        this.tenantUserQueryService = tenantUserQueryService;
        this.tenantMembershipManagementService = tenantMembershipManagementService;
        this.invitationResponseMapper = invitationResponseMapper;
    }

    /**
     * Retrieves the branding configuration for the current tenant.
     *
     * @return the current tenant's branding configuration
     */
    @GetMapping("/branding")
    ResponseEntity<Response<BrandingView>> getBranding() {
        TenantBranding branding = tenantBrandingService.getBranding(TenantContext.requireTenantId());
        return ResponseEntity.ok(Response.ok(toView(branding)));
    }

    @PutMapping("/branding")
    ResponseEntity<Response<BrandingView>> updateBranding(@Valid @RequestBody BrandingUpdateRequest request) {
        TenantBranding branding = tenantBrandingService.updateBranding(
                TenantContext.requireTenantId(),
                request.siteTitle(),
                request.primaryColor(),
                request.secondaryColor(),
                request.logoUrl(),
                request.umamiWebsiteId()
        );
        return ResponseEntity.ok(Response.ok(toView(branding)));
    }

    @GetMapping("/domains")
    ResponseEntity<Response<List<DomainView>>> listDomains() {
        List<DomainView> domains = tenantDomainService.listDomains(TenantContext.requireTenantId()).stream()
                .map(domain -> new DomainView(domain.getHost(), domain.isPrimary(), domain.isVerified()))
                .toList();
        return ResponseEntity.ok(Response.ok(domains));
    }

    /**
     * Adds a domain to the current tenant.
     *
     * @param request the domain details, including its host and primary status
     * @return a created response containing the added domain
     */
    @PostMapping("/domains")
    ResponseEntity<Response<DomainView>> addDomain(@Valid @RequestBody AddDomainRequest request) {
        TenantDomain domain = tenantDomainService.addDomain(
                TenantContext.requireTenantId(),
                request.host(),
                request.isPrimary()
        );
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Response.created(new DomainView(domain.getHost(), domain.isPrimary(), domain.isVerified())));
    }

    /**
     * Retrieves the DNS verification challenge for a tenant domain.
     *
     * @param host the domain host for which to retrieve verification details
     * @return the domain verification challenge
     */
    @GetMapping("/domains/{host:.+}/verification")
    ResponseEntity<Response<DomainVerificationView>> getDomainVerification(@PathVariable String host) {
        TenantDomainService.DomainVerificationChallenge challenge =
                tenantDomainService.getVerificationChallenge(TenantContext.requireTenantId(), host);
        return ResponseEntity.ok(Response.ok(new DomainVerificationView(
                challenge.host(),
                challenge.token(),
                challenge.dnsTxtValue(),
                challenge.dnsNameHint()
        )));
    }

    /**
     * Verifies a tenant domain using DNS-based ownership verification.
     *
     * @param host    the domain host to verify
     * @param request the optional request (ignored - DNS verification only)
     * @return the verified domain details
     */
    @PostMapping("/domains/{host:.+}/verify")
    ResponseEntity<Response<DomainView>> verifyDomain(
            @PathVariable String host,
            @RequestBody(required = false) VerifyDomainRequest request
    ) {
        TenantDomain domain = tenantDomainService.verifyDomain(
                TenantContext.requireTenantId(),
                host,
                null,
                false
        );
        return ResponseEntity.ok(Response.ok(new DomainView(domain.getHost(), domain.isPrimary(), domain.isVerified())));
    }

    /**
     * Invites a user to the current tenant.
     *
     * @param request the invitation details, including the user's email, name, and role
     * @return the created invitation response, or a conflict response if the user is already a member
     */
    @PostMapping("/users/invite")
    ResponseEntity<Response<de.pnnit.directwerk.api.dto.InviteUserResponse>> inviteUser(
            @Valid @RequestBody InviteRequest request
    ) {
                TenantInvitationService.InvitationResult invitation = tenantInvitationService.invite(
                TenantContext.requireTenantId(),
                request.email(),
                request.name(),
                request.role()
        );
        return invitationResponseMapper.toCreatedResponse(invitation);
    }

    @GetMapping("/users")
    ResponseEntity<Response<List<UserView>>> listUsers() {
        List<UserView> users = tenantUserQueryService.listTenantUsers(TenantContext.requireTenantId()).stream()
                .map(user -> new UserView(
                        user.userId(),
                        user.email(),
                        user.name(),
                        user.roles(),
                        user.status()
                ))
                .toList();
        return ResponseEntity.ok(Response.ok(users));
    }

    /**
     * Deactivates a user's membership in the current tenant.
     *
     * @param userId the identifier of the user to deactivate
     * @return the updated membership view
     */
    @PostMapping("/users/{userId}/deactivate")
    ResponseEntity<Response<TenantUserView>> deactivateUser(@PathVariable Long userId) {
        return ResponseEntity.ok(Response.ok(
                tenantMembershipManagementService.deactivateMembership(TenantContext.requireTenantId(), userId)
        ));
    }

    /**
     * Reactivates a previously deactivated user's membership in the current tenant.
     *
     * @param userId the identifier of the user to reactivate
     * @return the updated membership view
     */
    @PostMapping("/users/{userId}/reactivate")
    ResponseEntity<Response<TenantUserView>> reactivateUser(@PathVariable Long userId) {
        return ResponseEntity.ok(Response.ok(
                tenantMembershipManagementService.reactivateMembership(TenantContext.requireTenantId(), userId)
        ));
    }

    private BrandingView toView(TenantBranding branding) {
        return new BrandingView(
                branding.getSiteTitle(),
                branding.getPrimaryColor(),
                branding.getSecondaryColor(),
                branding.getLogoUrl(),
                branding.getUmamiWebsiteId()
        );
    }

    public record BrandingUpdateRequest(
            @Size(max = 255) String siteTitle,
            @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String primaryColor,
            @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String secondaryColor,
            String logoUrl,
            @Pattern(regexp = "^\\s*$|^[a-zA-Z0-9-]{8,64}$") String umamiWebsiteId
    ) {
    }

    public record BrandingView(
            String siteTitle,
            String primaryColor,
            String secondaryColor,
            String logoUrl,
            String umamiWebsiteId
    ) {
    }

    public record AddDomainRequest(@NotBlank String host, boolean isPrimary) {
    }

    public record VerifyDomainRequest(String token) {
    }

    public record DomainVerificationView(
            String host,
            String token,
            String dnsTxtValue,
            String dnsNameHint
    ) {
    }

    public record InviteRequest(
            @NotBlank @Email String email,
            String name,
            @NotBlank String role
    ) {
    }

    public record UserView(
            Long userId,
            String email,
            String name,
            List<String> roles,
            String status
    ) {
    }
}
