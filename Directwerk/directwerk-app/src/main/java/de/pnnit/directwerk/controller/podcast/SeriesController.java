package de.pnnit.directwerk.controller.podcast;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantLookupService;
import de.pnnit.directwerk.modules.core.util.PublicUrlBuilder;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.service.SeriesService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiresModule(PodcastModule.KEY)
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/series")
public class SeriesController {

    private final SeriesService seriesService;
    private final ModuleGateService moduleGateService;
    private final TenantLookupService tenantLookupService;

    /**
     * Creates a controller for managing podcast series.
     *
     * @param seriesService        service for series operations
     * @param moduleGateService    service for checking tenant module availability
     * @param tenantLookupService  service for resolving tenant details
     */
    public SeriesController(
            SeriesService seriesService,
            ModuleGateService moduleGateService,
            TenantLookupService tenantLookupService
    ) {
        this.seriesService = seriesService;
        this.moduleGateService = moduleGateService;
        this.tenantLookupService = tenantLookupService;
    }

    /**
     * Lists the series available to the current tenant.
     *
     * @param request the HTTP request used to determine the public RSS URL origin
     * @return the tenant's series, including RSS URLs when the RSS module is enabled
     */
    @GetMapping
    ResponseEntity<Response<List<SeriesView>>> listSeries(HttpServletRequest request) {
        Long tenantId = TenantContext.requireTenantId();
        boolean rssModuleEnabled = moduleGateService.enabledModuleKeys(tenantId).contains(PodcastRssModule.KEY);
        String rssOrigin = null;
        String tenantSlug = null;
        if (rssModuleEnabled) {
            Tenant tenant = tenantLookupService.requireTenant(tenantId);
            tenantSlug = tenant.getSlug();
            rssOrigin = PublicUrlBuilder.baseUrl(
                    request.getScheme(),
                    request.getServerName(),
                    request.getServerPort()
            );
        }
        final String finalRssOrigin = rssOrigin;
        final String finalTenantSlug = tenantSlug;
        List<SeriesView> series = seriesService.listSeries(tenantId, false).stream()
                .map(item -> toView(item, finalRssOrigin, finalTenantSlug))
                .toList();
        return ResponseEntity.ok(Response.ok(series));
    }

    /**
     * Retrieves a tenant-scoped podcast series and its API view.
     *
     * @param seriesId the identifier of the series to retrieve
     * @return the requested series view
     */
    @GetMapping("/{seriesId}")
    ResponseEntity<Response<SeriesView>> getSeries(@PathVariable Long seriesId, HttpServletRequest request) {
        Long tenantId = TenantContext.requireTenantId();
        boolean rssModuleEnabled = moduleGateService.enabledModuleKeys(tenantId).contains(PodcastRssModule.KEY);
        String rssOrigin = null;
        String tenantSlug = null;
        if (rssModuleEnabled) {
            Tenant tenant = tenantLookupService.requireTenant(tenantId);
            tenantSlug = tenant.getSlug();
            rssOrigin = PublicUrlBuilder.baseUrl(
                    request.getScheme(),
                    request.getServerName(),
                    request.getServerPort()
            );
        }
        return ResponseEntity.ok(
                Response.ok(toView(seriesService.requireSeries(tenantId, seriesId), rssOrigin, tenantSlug))
        );
    }

    /**
     * Creates a podcast series for the current tenant.
     *
     * @param request     the series details to create
     * @param httpRequest the request used to build the RSS feed URL
     * @return the created series, or a conflict response when its slug already exists
     */
    @PostMapping
    ResponseEntity<Response<SeriesView>> createSeries(
            @Valid @RequestBody CreateSeriesRequest request,
            HttpServletRequest httpRequest
    ) {
        Long tenantId = TenantContext.requireTenantId();
        try {
            PodcastSeries series = seriesService.createSeries(
                    tenantId,
                    request.slug(),
                    request.title(),
                    request.description(),
                    request.coverAssetId(),
                    request.language(),
                    request.itunesCategory(),
                    request.defaultRequiredLevelSortOrder()
            );
            boolean rssModuleEnabled = moduleGateService.enabledModuleKeys(tenantId).contains(PodcastRssModule.KEY);
            String rssOrigin = null;
            String tenantSlug = null;
            if (rssModuleEnabled) {
                Tenant tenant = tenantLookupService.requireTenant(tenantId);
                tenantSlug = tenant.getSlug();
                rssOrigin = PublicUrlBuilder.baseUrl(
                        httpRequest.getScheme(),
                        httpRequest.getServerName(),
                        httpRequest.getServerPort()
                );
            }
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Response.created(toView(series, rssOrigin, tenantSlug)));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Response.error(409, "SERIES_SLUG_EXISTS", ex.getMessage()));
        }
    }

    /**
     * Updates a podcast series and returns its current representation.
     *
     * @param seriesId the identifier of the series to update
     * @param request the updated series fields
     * @return the updated series, or a conflict response when the slug is already in use
     */
    @PutMapping("/{seriesId}")
    ResponseEntity<Response<SeriesView>> updateSeries(
            @PathVariable Long seriesId,
            @Valid @RequestBody UpdateSeriesRequest request,
            HttpServletRequest httpRequest
    ) {
        Long tenantId = TenantContext.requireTenantId();
        try {
            PodcastSeries series = seriesService.updateSeries(
                    tenantId,
                    seriesId,
                    request.slug(),
                    request.title(),
                    request.description(),
                    request.coverAssetId(),
                    request.language(),
                    request.itunesCategory(),
                    request.defaultRequiredLevelSortOrder(),
                    request.status()
            );
            boolean rssModuleEnabled = moduleGateService.enabledModuleKeys(tenantId).contains(PodcastRssModule.KEY);
            String rssOrigin = null;
            String tenantSlug = null;
            if (rssModuleEnabled) {
                Tenant tenant = tenantLookupService.requireTenant(tenantId);
                tenantSlug = tenant.getSlug();
                rssOrigin = PublicUrlBuilder.baseUrl(
                        httpRequest.getScheme(),
                        httpRequest.getServerName(),
                        httpRequest.getServerPort()
                );
            }
            return ResponseEntity.ok(Response.ok(toView(series, rssOrigin, tenantSlug)));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Response.error(409, "SERIES_SLUG_EXISTS", ex.getMessage()));
        }
    }

    /**
     * Converts a podcast series into its API view, including its RSS feed URL when RSS details are available.
     *
     * @param series    the podcast series to convert
     * @param rssOrigin the public origin used to build the RSS feed URL
     * @param tenantSlug the tenant slug used to build the RSS feed URL
     * @return the API view representing the series
     */
    private SeriesView toView(PodcastSeries series, String rssOrigin, String tenantSlug) {
        String rssUrl = null;
        if (rssOrigin != null && tenantSlug != null) {
            rssUrl = rssOrigin + "/feeds/" + tenantSlug + "/" + series.getSlug() + ".xml";
        }
        return new SeriesView(
                series.getId(),
                series.getSlug(),
                series.getTitle(),
                series.getDescription(),
                series.getCoverAsset() != null ? series.getCoverAsset().getId() : null,
                series.getLanguage(),
                series.getItunesCategory(),
                series.getDefaultRequiredLevelSortOrder(),
                series.getStatus().name(),
                rssUrl,
                series.getCreatedAt(),
                series.getUpdatedAt()
        );
    }

    public record CreateSeriesRequest(
            @NotBlank
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @NotBlank @Size(max = 255) String title,
            String description,
            @Min(1) Long coverAssetId,
            @Size(max = 8) String language,
            @Size(max = 128) String itunesCategory,
            @Min(0) Integer defaultRequiredLevelSortOrder
    ) {
    }

    public record UpdateSeriesRequest(
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @Size(max = 255) String title,
            String description,
            @Min(1) Long coverAssetId,
            @Size(max = 8) String language,
            @Size(max = 128) String itunesCategory,
            @Min(0) Integer defaultRequiredLevelSortOrder,
            SeriesStatus status
    ) {
    }

    public record SeriesView(
            Long id,
            String slug,
            String title,
            String description,
            Long coverAssetId,
            String language,
            String itunesCategory,
            Integer defaultRequiredLevelSortOrder,
            String status,
            String rssUrl,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
