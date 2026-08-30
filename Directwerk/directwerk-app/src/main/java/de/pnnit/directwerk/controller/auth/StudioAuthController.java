package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.StudioWorkspaceDiscoveryService;
import de.pnnit.directwerk.modules.core.service.StudioWorkspaceDiscoveryService.StudioWorkspaceView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Host-agnostic studio login helpers for shared {@code directwerk-studio} deployments.
 */
@RestController
@RequestMapping("/api/v1/auth/studio")
public class StudioAuthController {

    private final StudioWorkspaceDiscoveryService studioWorkspaceDiscoveryService;

    public StudioAuthController(StudioWorkspaceDiscoveryService studioWorkspaceDiscoveryService) {
        this.studioWorkspaceDiscoveryService = studioWorkspaceDiscoveryService;
    }

    /**
     * Verifies editor/admin credentials and returns tenant workspaces the user may open in studio.
     */
    @PostMapping("/workspaces")
    ResponseEntity<Response<StudioWorkspacesResponse>> workspaces(
            @Valid @RequestBody StudioWorkspacesRequest body
    ) {
        List<StudioWorkspaceView> workspaces = studioWorkspaceDiscoveryService.discoverWorkspaces(
                body.email(),
                body.password()
        );
        List<StudioWorkspaceResponse> items = workspaces.stream()
                .map(workspace -> new StudioWorkspaceResponse(
                        workspace.tenantId(),
                        workspace.slug(),
                        workspace.name(),
                        workspace.host()
                ))
                .toList();
        return ResponseEntity.ok(Response.ok(new StudioWorkspacesResponse(items)));
    }

    public record StudioWorkspacesRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 128) String password
    ) {
    }

    public record StudioWorkspacesResponse(List<StudioWorkspaceResponse> workspaces) {
    }

    public record StudioWorkspaceResponse(Long tenantId, String slug, String name, String host) {
    }
}
