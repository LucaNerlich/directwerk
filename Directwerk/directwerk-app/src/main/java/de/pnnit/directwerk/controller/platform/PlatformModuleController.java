package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.ModuleManagementService;
import de.pnnit.directwerk.modules.core.service.ModuleManagementService.ModuleView;
import de.pnnit.directwerk.modules.core.service.ModuleManagementService.TenantModulesView;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequestMapping("/api/v1/platform")
public class PlatformModuleController {

    private static final String MODULE_KEY_PATTERN = "^[A-Z][A-Z0-9_]{0,63}$";
    private static final String PRESET_KEY_PATTERN = "^[A-Z][A-Z0-9_]{0,63}$";

    private final ModuleManagementService moduleManagementService;

    public PlatformModuleController(ModuleManagementService moduleManagementService) {
        this.moduleManagementService = moduleManagementService;
    }

    @GetMapping("/modules")
    ResponseEntity<Response<List<ModuleView>>> listModules() {
        return ResponseEntity.ok(Response.ok(moduleManagementService.listAllModules()));
    }

    @GetMapping("/tenants/{tenantId}/modules")
    ResponseEntity<Response<TenantModulesView>> getTenantModules(@PathVariable Long tenantId) {
        return ResponseEntity.ok(Response.ok(moduleManagementService.getTenantModules(tenantId)));
    }

    @PostMapping("/tenants/{tenantId}/modules/{moduleKey}/activate")
    ResponseEntity<Response<TenantModulesView>> activateModule(
            @PathVariable Long tenantId,
            @PathVariable @Pattern(regexp = MODULE_KEY_PATTERN) @Size(max = 64) String moduleKey
    ) {
        return ResponseEntity.ok(Response.ok(moduleManagementService.activateModule(tenantId, moduleKey)));
    }

    @DeleteMapping("/tenants/{tenantId}/modules/{moduleKey}")
    ResponseEntity<Response<TenantModulesView>> deactivateModule(
            @PathVariable Long tenantId,
            @PathVariable @Pattern(regexp = MODULE_KEY_PATTERN) @Size(max = 64) String moduleKey
    ) {
        return ResponseEntity.ok(Response.ok(moduleManagementService.deactivateModule(tenantId, moduleKey)));
    }

    @PostMapping("/tenants/{tenantId}/modules/preset/{presetKey}")
    ResponseEntity<Response<TenantModulesView>> applyPreset(
            @PathVariable Long tenantId,
            @PathVariable @Pattern(regexp = PRESET_KEY_PATTERN) @Size(max = 64) String presetKey
    ) {
        return ResponseEntity.ok(Response.ok(moduleManagementService.applyPreset(tenantId, presetKey)));
    }
}
