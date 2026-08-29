package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.PlatformAuditQueryService;
import de.pnnit.directwerk.modules.core.service.PlatformAuditQueryService.AuditPage;
import de.pnnit.directwerk.modules.core.service.PlatformAuditQueryService.AuditQuery;
import de.pnnit.directwerk.modules.core.service.PlatformAuditQueryService.PlatformAuditView;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.Map;
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

    @GetMapping
    ResponseEntity<Response<List<PlatformAuditView>>> listRecent(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int size,
            @RequestParam(required = false) Long tenantId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String actorEmail,
            @RequestParam(required = false) Long actorUserId
    ) {
        AuditPage auditPage = platformAuditQueryService.list(
                new AuditQuery(page, size, tenantId, action, actorEmail, actorUserId)
        );
        return ResponseEntity.ok(Response.ok(
                auditPage.content(),
                Map.of(
                        "page", auditPage.page(),
                        "size", auditPage.size(),
                        "totalElements", auditPage.totalElements()
                )
        ));
    }
}
