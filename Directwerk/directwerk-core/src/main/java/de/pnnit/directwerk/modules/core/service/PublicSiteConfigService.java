package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.FeatureModuleKeys;
import de.pnnit.directwerk.modules.core.AnalyticsModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.repository.TenantBrandingRepository;
import de.pnnit.directwerk.modules.core.util.UmamiWebsiteIdValidator;
import de.pnnit.directwerk.modules.core.service.StudioNavigationService.StudioNavigationView;
import de.pnnit.directwerk.multitenancy.TenantNotFoundException;
import de.pnnit.directwerk.multitenancy.TenantResolver;
import de.pnnit.directwerk.modules.core.util.FeedUrls;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PublicSiteConfigService {

    private static final String EMAIL_NOTIFY_MODULE_KEY = "EMAIL_NOTIFY";

    private final DirectwerkConfig directwerkConfig;
    private final TenantResolver tenantResolver;
    private final TenantBrandingRepository tenantBrandingRepository;
    private final ModuleGateService moduleGateService;
    private final StudioNavigationService studioNavigationService;

    /**
     * Loads the public site configuration for a tenant resolved from the host.
     *
     * @param scheme the URL scheme used to build public resource URLs
     * @param host   the tenant host
     * @param port   the port used to build public resource URLs
     * @return the assembled public site configuration
     * @throws TenantNotFoundException if no tenant is resolved for the host
     */
    @Transactional(readOnly = true)
    @Cacheable(
            cacheNames = DirectwerkCacheNames.PUBLIC_SITE_CONFIG,
            key = "#host.trim().toLowerCase(T(java.util.Locale).ROOT) + ':' + #scheme + ':' + #port",
            condition = "#host != null && !#host.isBlank()"
    )
    public SiteConfigView loadSiteConfig(String scheme, String host, int port) {
        Tenant tenant = tenantResolver.resolveHost(host)
                .orElseThrow(() -> new TenantNotFoundException(host));

        TenantBranding branding = tenantBrandingRepository.findByTenantId(tenant.getId())
                .orElse(null);
        List<String> enabledModules = moduleGateService.enabledModuleKeys(tenant.getId()).stream()
                .sorted()
                .toList();
        StudioNavigationView studioNavigation = studioNavigationService.resolve(enabledModules);
        return new SiteConfigView(
                new TenantView(tenant.getSlug(), tenant.getName()),
                enabledModules,
                brandingView(branding),
                publicRssUrl(scheme, host, port, tenant, enabledModules),
                analyticsView(branding, enabledModules),
                studioNavigation.home(),
                studioNavigation.desks(),
                emailNotifyAvailable(enabledModules)
        );
    }

    /**
     * Creates a branding view from the tenant branding data.
     *
     * @param branding the tenant branding data, or {@code null} when branding is unavailable
     * @return a branding view containing the branding values, or an empty view when branding is unavailable
     */
    private static BrandingView brandingView(TenantBranding branding) {
        if (branding == null) {
            return new BrandingView(null, null, null, null);
        }
        return new BrandingView(
                branding.getSiteTitle(),
                branding.getPrimaryColor(),
                branding.getSecondaryColor(),
                branding.getLogoUrl()
        );
    }

    /**
     * Builds the public podcast RSS feed URL when the podcast RSS module is enabled.
     *
     * @param scheme          the URL scheme
     * @param host            the request host
     * @param port            the request port
     * @param tenant          the tenant whose podcast feed is requested
     * @param enabledModules  the module keys enabled for the tenant
     * @return the podcast RSS feed URL, or {@code null} when the module is disabled
     */
    private static String publicRssUrl(String scheme, String host, int port, Tenant tenant, List<String> enabledModules) {
        if (!enabledModules.contains(FeatureModuleKeys.PODCAST_RSS)) {
            return null;
        }
        String origin = de.pnnit.directwerk.modules.core.util.PublicUrlBuilder.baseUrl(
                scheme, host.trim().toLowerCase(java.util.Locale.ROOT), port
        );
        return FeedUrls.tenantPodcastFeed(origin, tenant.getSlug());
    }

    /**
     * Builds analytics configuration when analytics is enabled for the tenant.
     *
     * @param branding the tenant branding containing the Umami website ID
     * @param enabledModules the modules enabled for the tenant
     * @return analytics configuration, or {@code null} when analytics is unavailable or not configured
     */
    private AnalyticsView analyticsView(TenantBranding branding, List<String> enabledModules) {
        if (!directwerkConfig.isAnalyticsEnabled()
                || !enabledModules.contains(AnalyticsModule.KEY)
                || branding == null
                || !UmamiWebsiteIdValidator.isValid(branding.getUmamiWebsiteId())) {
            return null;
        }
        String hostUrl = trimTrailingSlash(directwerkConfig.analytics().umamiHostUrl());
        return new AnalyticsView(
                branding.getUmamiWebsiteId(),
                hostUrl,
                hostUrl + "/script.js"
        );
    }

    private static String trimTrailingSlash(String value) {
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    /**
     * Returns whether subscriber notification can actually be delivered.
     * The EMAIL_NOTIFY module alone is not enough — platform email must also be enabled.
     *
     * @param enabledModules the module keys enabled for the tenant
     * @return {@code true} when the notify checkbox should be offered in studio
     */
    private boolean emailNotifyAvailable(List<String> enabledModules) {
        return enabledModules.contains(EMAIL_NOTIFY_MODULE_KEY) && directwerkConfig.isEmailEnabled();
    }

    public record SiteConfigView(
            TenantView tenant,
            List<String> enabledModules,
            BrandingView branding,
            String publicRssUrl,
            AnalyticsView analytics,
            StudioHome studioHome,
            List<StudioDesk> studioDesks,
            boolean emailNotifyAvailable
    ) {
    }

    public record TenantView(String slug, String name) {
    }

    public record BrandingView(String siteTitle, String primaryColor, String secondaryColor, String logoUrl) {
    }

    public record AnalyticsView(String umamiWebsiteId, String umamiHostUrl, String umamiScriptUrl) {
    }
}
