package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.PublicSiteConfigService;
import de.pnnit.directwerk.modules.core.service.StudioDesk;
import de.pnnit.directwerk.modules.core.service.StudioHome;
import de.pnnit.directwerk.modules.core.service.PublicSiteConfigService.AnalyticsView;
import de.pnnit.directwerk.modules.core.service.PublicSiteConfigService.BrandingView;
import de.pnnit.directwerk.modules.core.service.PublicSiteConfigService.SiteConfigView;
import de.pnnit.directwerk.modules.core.service.PublicSiteConfigService.TenantView;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/site-config")
public class PublicSiteConfigController {

    private final PublicSiteConfigService publicSiteConfigService;

    public PublicSiteConfigController(PublicSiteConfigService publicSiteConfigService) {
        this.publicSiteConfigService = publicSiteConfigService;
    }

    /**
     * Loads the public site configuration for the request host and returns it in the standard response format.
     *
     * @param request the HTTP request used to determine the request scheme, server name, and server port
     * @return the public site configuration response
     */
    @GetMapping
    ResponseEntity<Response<SiteConfigResponse>> siteConfig(HttpServletRequest request) {
        SiteConfigView config = publicSiteConfigService.loadSiteConfig(
                request.getScheme(), request.getServerName(), request.getServerPort()
        );
        return ResponseEntity.ok(Response.ok(toResponse(config)));
    }

    private static SiteConfigResponse toResponse(SiteConfigView config) {
        TenantView tenant = config.tenant();
        BrandingView branding = config.branding();
        AnalyticsView analytics = config.analytics();
        return new SiteConfigResponse(
                new TenantResponse(tenant.slug(), tenant.name()),
                config.enabledModules(),
                new BrandingResponse(
                        branding.siteTitle(),
                        branding.primaryColor(),
                        branding.secondaryColor(),
                        branding.logoUrl()
                ),
                config.publicRssUrl(),
                analytics == null ? null : new AnalyticsResponse(
                        analytics.umamiWebsiteId(),
                        analytics.umamiHostUrl(),
                        analytics.umamiScriptUrl()
                ),
                config.studioHome(),
                config.studioDesks(),
                config.emailNotifyAvailable()
        );
    }

    public record SiteConfigResponse(
            TenantResponse tenant,
            java.util.List<String> enabledModules,
            BrandingResponse branding,
            String publicRssUrl,
            AnalyticsResponse analytics,
            StudioHome studioHome,
            java.util.List<StudioDesk> studioDesks,
            boolean emailNotifyAvailable
    ) {
    }

    public record TenantResponse(String slug, String name) {
    }

    public record BrandingResponse(String siteTitle, String primaryColor, String secondaryColor, String logoUrl) {
    }

    public record AnalyticsResponse(String umamiWebsiteId, String umamiHostUrl, String umamiScriptUrl) {
    }
}
