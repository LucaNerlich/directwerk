package de.pnnit.directwerk.controller.security;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/security")
public class SecurityProbeController {

    @GetMapping("/context")
    ResponseEntity<Response<SecurityContextView>> context(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal
    ) {
        // Prefer SecurityContext principal tenant; TenantContext must already match after filters.
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        return ResponseEntity.ok(Response.ok(new SecurityContextView(
                user.userId(),
                user.email(),
                user.roleNames(),
                user.tenantId()
        )));
    }

    @GetMapping("/platform")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    ResponseEntity<Response<RoleProbeResponse>> platformProbe() {
        return ResponseEntity.ok(Response.ok(new RoleProbeResponse("PLATFORM_ADMIN", "platform scope")));
    }

    @GetMapping("/tenant-admin")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    ResponseEntity<Response<RoleProbeResponse>> tenantAdminProbe() {
        return ResponseEntity.ok(Response.ok(new RoleProbeResponse("TENANT_ADMIN", "tenant admin scope")));
    }

    @GetMapping("/editor")
    @PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
    ResponseEntity<Response<RoleProbeResponse>> editorProbe() {
        return ResponseEntity.ok(Response.ok(new RoleProbeResponse("EDITOR", "editor scope")));
    }

    @GetMapping("/subscriber")
    @PreAuthorize("hasRole('SUBSCRIBER')")
    ResponseEntity<Response<RoleProbeResponse>> subscriberProbe() {
        return ResponseEntity.ok(Response.ok(new RoleProbeResponse("SUBSCRIBER", "subscriber scope")));
    }

    public record SecurityContextView(
            Long userId,
            String email,
            List<String> roles,
            Long tenantId
    ) {
    }

    public record RoleProbeResponse(String role, String scope) {
    }
}
