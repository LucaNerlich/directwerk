package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.service.PlatformAdminManagementService;
import de.pnnit.directwerk.modules.core.service.PlatformAdminManagementService.PlatformAdminInvitation;
import de.pnnit.directwerk.modules.core.service.PlatformAdminManagementService.AdminPage;
import de.pnnit.directwerk.modules.core.service.PlatformAdminManagementService.PlatformAdminView;
import java.util.Map;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

@RestController
@Validated
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequestMapping("/api/v1/platform/admins")
public class PlatformAdminController {

    private final PlatformAdminManagementService platformAdminManagementService;
    private final DirectwerkConfig directwerkConfig;

    /**
     * Creates a controller with the services and configuration required to manage platform administrators.
     *
     * @param platformAdminManagementService the service for managing platform administrators
     * @param directwerkConfig the application configuration
     */
    public PlatformAdminController(
            PlatformAdminManagementService platformAdminManagementService,
            DirectwerkConfig directwerkConfig
    ) {
        this.platformAdminManagementService = platformAdminManagementService;
        this.directwerkConfig = directwerkConfig;
    }

    /**
     * Lists one page of platform administrators.
     *
     * <p>Was unbounded — every admin in a single response (#438).
     *
     * @param page zero-based page index
     * @param size page size, 1-100
     * @return the page of administrators, with paging metadata in the envelope
     */
    @GetMapping
    ResponseEntity<Response<List<PlatformAdminView>>> listAdmins(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int size
    ) {
        AdminPage admins = platformAdminManagementService.listAdmins(page, size);
        return ResponseEntity.ok(Response.ok(
                admins.content(),
                Map.of(
                        "page", admins.page(),
                        "size", admins.size(),
                        "totalElements", admins.totalElements()
                )
        ));
    }

    /**
     * Invites a platform administrator and creates an invitation response.
     *
     * @param request the validated administrator invitation details
     * @return the created administrator's details, invitation status, and optionally an invitation token
     */
    @PostMapping("/invite")
    ResponseEntity<Response<PlatformAdminInvitationResponse>> inviteAdmin(
            @Valid @RequestBody InvitePlatformAdminRequest request
    ) {
        PlatformAdminInvitation invitation = platformAdminManagementService.inviteAdmin(
                request.email(),
                request.name()
        );
        PlatformAdminView admin = invitation.admin();
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(
                new PlatformAdminInvitationResponse(
                        admin.userId(),
                        admin.email(),
                        admin.name(),
                        invitation.status(),
                        directwerkConfig.isExposeDevTokens() ? invitation.inviteToken() : null
                )
        ));
    }

    /**
     * Revokes a platform administrator's access.
     *
     * @param userId the identifier of the user whose platform admin access is revoked
     * @return the revoked admin's details
     */
    @DeleteMapping("/{userId}")
    ResponseEntity<Response<PlatformAdminView>> revokeAdmin(
            @PathVariable Long userId
    ) {
        return ResponseEntity.ok(Response.ok(platformAdminManagementService.revokeAdmin(userId)));
    }

    public record InvitePlatformAdminRequest(@NotBlank @Email String email, String name) {
    }

    public record PlatformAdminInvitationResponse(
            Long userId,
            String email,
            String name,
            String status,
            String inviteToken
    ) {
    }
}
