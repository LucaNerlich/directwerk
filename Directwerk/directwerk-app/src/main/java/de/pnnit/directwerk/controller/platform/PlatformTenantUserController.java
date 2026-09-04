package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.api.dto.EffectiveRightsView;
import de.pnnit.directwerk.api.dto.InvitationResponseMapper;
import de.pnnit.directwerk.api.dto.PermissionRestrictionView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.core.service.TenantInvitationService;
import de.pnnit.directwerk.modules.core.service.TenantMembershipManagementService;
import de.pnnit.directwerk.modules.core.service.TenantUserQueryService;
import de.pnnit.directwerk.modules.core.service.TenantUserQueryService.TenantUserView;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
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
@RequestMapping("/api/v1/platform/tenants/{tenantId}/users")
public class PlatformTenantUserController {

    private final TenantUserQueryService tenantUserQueryService;
    private final TenantInvitationService tenantInvitationService;
    private final TenantMembershipManagementService tenantMembershipManagementService;
    private final MembershipPermissionService membershipPermissionService;
    private final InvitationResponseMapper invitationResponseMapper;

    public PlatformTenantUserController(
            TenantUserQueryService tenantUserQueryService,
            TenantInvitationService tenantInvitationService,
            TenantMembershipManagementService tenantMembershipManagementService,
            MembershipPermissionService membershipPermissionService,
            InvitationResponseMapper invitationResponseMapper
    ) {
        this.tenantUserQueryService = tenantUserQueryService;
        this.tenantInvitationService = tenantInvitationService;
        this.tenantMembershipManagementService = tenantMembershipManagementService;
        this.membershipPermissionService = membershipPermissionService;
        this.invitationResponseMapper = invitationResponseMapper;
    }

    @GetMapping
    ResponseEntity<Response<TenantUserListResponse>> listUsers(@PathVariable Long tenantId) {
        List<TenantUserView> users = tenantUserQueryService.listTenantUsers(tenantId);
        return ResponseEntity.ok(Response.ok(new TenantUserListResponse(users)));
    }

    @PostMapping("/invite")
    ResponseEntity<Response<de.pnnit.directwerk.api.dto.InviteUserResponse>> inviteUser(
            @PathVariable Long tenantId,
            @Valid @RequestBody InviteTenantUserRequest request
    ) {
                TenantInvitationService.InvitationResult invitation = tenantInvitationService.invite(
                tenantId,
                request.email(),
                request.name(),
                request.role()
        );
        return invitationResponseMapper.toCreatedResponse(invitation);
    }

    /**
     * Deactivates a user's membership in the given tenant.
     *
     * @param tenantId the tenant the membership belongs to
     * @param userId   the identifier of the user to deactivate
     * @return the updated membership view
     */
    @PostMapping("/{userId}/deactivate")
    ResponseEntity<Response<TenantUserView>> deactivateUser(
            @PathVariable Long tenantId,
            @PathVariable Long userId
    ) {
        return ResponseEntity.ok(Response.ok(
                tenantMembershipManagementService.deactivateMembership(tenantId, userId)
        ));
    }

    /**
     * Reactivates a previously deactivated user's membership in the given tenant.
     *
     * @param tenantId the tenant the membership belongs to
     * @param userId   the identifier of the user to reactivate
     * @return the updated membership view
     */
    @PostMapping("/{userId}/reactivate")
    ResponseEntity<Response<TenantUserView>> reactivateUser(
            @PathVariable Long tenantId,
            @PathVariable Long userId
    ) {
        return ResponseEntity.ok(Response.ok(
                tenantMembershipManagementService.reactivateMembership(tenantId, userId)
        ));
    }

    /**
     * Re-sends an invitation email for a pending tenant membership.
     */
    @PostMapping("/{userId}/resend-invite")
    ResponseEntity<Response<de.pnnit.directwerk.api.dto.InviteUserResponse>> resendInvite(
            @PathVariable Long tenantId,
            @PathVariable Long userId
    ) {
        TenantInvitationService.InvitationResult invitation = tenantInvitationService.resendInvite(
                tenantId,
                userId
        );
        return invitationResponseMapper.toCreatedResponse(invitation);
    }

    @PatchMapping("/{userId}")
    ResponseEntity<Response<TenantUserView>> updateUserRole(
            @PathVariable Long tenantId,
            @PathVariable Long userId,
            @Valid @RequestBody UpdateTenantUserRoleRequest request
    ) {
        return ResponseEntity.ok(Response.ok(
                tenantMembershipManagementService.updateRole(tenantId, userId, request.role())
        ));
    }

    /**
     * Read-only effective rights of one member for the platform RBAC overview.
     * Computed server-side, same matrix as the tenant dashboard.
     */
    @GetMapping("/{userId}/effective-rights")
    ResponseEntity<Response<EffectiveRightsView>> effectiveRights(
            @PathVariable Long tenantId,
            @PathVariable Long userId
    ) {
        MembershipPermissionService.MemberRights rights = TenantContext.callWithTenant(
                tenantId,
                () -> membershipPermissionService.effectiveRightsForMember(tenantId, userId));
        List<PermissionRestrictionView> restrictions = rights.restrictions().stream()
                .map(override -> new PermissionRestrictionView(
                        override.getEntityType(), override.getOperation(), override.getScope()))
                .toList();
        return ResponseEntity.ok(Response.ok(new EffectiveRightsView(
                rights.userId(), rights.roles(), restrictions, rights.effective())));
    }

    public record TenantUserListResponse(List<TenantUserView> content) {
    }

    public record InviteTenantUserRequest(
            @NotBlank @Email String email,
            String name,
            @NotBlank String role
    ) {
    }

    public record UpdateTenantUserRoleRequest(@NotBlank String role) {
    }
}
