package de.pnnit.directwerk.modules.email.content;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class TenantContentBrandingResolver {

    private static final String DEFAULT_PRIMARY_COLOR = "#2563eb";

    private final TenantRepository tenantRepository;
    private final TenantBrandingService tenantBrandingService;

    public TenantContentBrandingResolver(
            TenantRepository tenantRepository,
            TenantBrandingService tenantBrandingService
    ) {
        this.tenantRepository = tenantRepository;
        this.tenantBrandingService = tenantBrandingService;
    }

    public BrandingContext resolve(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow();
        TenantBranding branding = tenantBrandingService.getBranding(tenantId);
        String siteTitle = StringUtils.hasText(branding.getSiteTitle()) ? branding.getSiteTitle() : tenant.getName();
        String primaryColor = StringUtils.hasText(branding.getPrimaryColor())
                ? branding.getPrimaryColor()
                : DEFAULT_PRIMARY_COLOR;
        return new BrandingContext(tenant.getName(), siteTitle, primaryColor);
    }

    public record BrandingContext(String tenantName, String siteTitle, String primaryColor) {
    }
}
