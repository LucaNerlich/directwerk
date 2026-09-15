package de.pnnit.directwerk.controller.analytics;

import de.pnnit.directwerk.analytics.AnalyticsQueryException;
import de.pnnit.directwerk.analytics.AnalyticsQueryService;
import de.pnnit.directwerk.analytics.AnalyticsRange;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.multitenancy.TenantContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/tenant/analytics")
public class TenantAnalyticsController {

    private final AnalyticsQueryService analyticsQueryService;

    public TenantAnalyticsController(AnalyticsQueryService analyticsQueryService) {
        this.analyticsQueryService = analyticsQueryService;
    }

    @GetMapping("/stats/{range}")
    ResponseEntity<Response<AnalyticsQueryService.StatsView>> stats(@PathVariable String range) {
        AnalyticsRange parsed = AnalyticsRange.fromParam(range)
                .orElseThrow(() -> new AnalyticsQueryException(
                        "ANALYTICS_RANGE_INVALID",
                        HttpStatus.BAD_REQUEST,
                        "Unknown range. Use 7d, 30d or 12m."
                ));
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(analyticsQueryService.query(tenantId, parsed)));
    }
}
