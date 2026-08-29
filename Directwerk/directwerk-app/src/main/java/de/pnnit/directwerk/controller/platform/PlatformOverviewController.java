package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.PlatformOverviewService;
import de.pnnit.directwerk.modules.core.service.PlatformOverviewService.PlatformOverviewView;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequestMapping("/api/v1/platform/overview")
public class PlatformOverviewController {

    private final PlatformOverviewService platformOverviewService;

    public PlatformOverviewController(PlatformOverviewService platformOverviewService) {
        this.platformOverviewService = platformOverviewService;
    }

    @GetMapping
    ResponseEntity<Response<PlatformOverviewView>> getOverview(
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int recentAuditLimit
    ) {
        return ResponseEntity.ok(Response.ok(platformOverviewService.getOverview(recentAuditLimit)));
    }
}
