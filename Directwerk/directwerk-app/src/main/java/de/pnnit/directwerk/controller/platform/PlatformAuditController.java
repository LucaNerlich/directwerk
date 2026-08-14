package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.PlatformAuditQueryService;
import de.pnnit.directwerk.modules.core.service.PlatformAuditQueryService.PlatformAuditView;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
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
@RequestMapping("/api/v1/platform/audit")
public class PlatformAuditController {

    private final PlatformAuditQueryService platformAuditQueryService;

    public PlatformAuditController(PlatformAuditQueryService platformAuditQueryService) {
        this.platformAuditQueryService = platformAuditQueryService;
    }

    /**
     * Lists recent platform audit events (newest first).
     *
     * @param limit max rows (1–100, default 50)
     * @return audit event views
     */
    @GetMapping
    ResponseEntity<Response<List<PlatformAuditView>>> listRecent(
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit
    ) {
        return ResponseEntity.ok(Response.ok(platformAuditQueryService.listRecent(limit)));
    }
}
