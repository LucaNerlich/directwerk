package de.pnnit.directwerk.controller.probe;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/probes")
public class ModuleProbeController {

    private final ModuleGateService moduleGateService;

    public ModuleProbeController(ModuleGateService moduleGateService) {
        this.moduleGateService = moduleGateService;
    }

    @GetMapping("/digital")
    ResponseEntity<Response<ProbeResponse>> digitalProbe() {
        moduleGateService.requireModule("DIGITAL_CONTENT");
        return ResponseEntity.ok(Response.ok(new ProbeResponse("DIGITAL_CONTENT", "enabled")));
    }

    @GetMapping("/podcast")
    ResponseEntity<Response<ProbeResponse>> podcastProbe() {
        moduleGateService.requireModule("PODCAST");
        return ResponseEntity.ok(Response.ok(new ProbeResponse("PODCAST", "enabled")));
    }

    public record ProbeResponse(String module, String status) {
    }
}
