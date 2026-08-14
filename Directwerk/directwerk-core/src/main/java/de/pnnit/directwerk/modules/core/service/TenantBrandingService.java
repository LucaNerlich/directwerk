package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.repository.TenantBrandingRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.UmamiWebsiteIdValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TenantBrandingService {

    private final TenantBrandingRepository tenantBrandingRepository;
    private final TenantRepository tenantRepository;
    private final DirectwerkCacheEviction cacheEviction;

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = DirectwerkCacheNames.TENANT_BRANDING, key = "#tenantId")
    public TenantBranding getBranding(Long tenantId) {
        return tenantBrandingRepository.findByTenantId(tenantId)
                .orElseGet(() -> {
                    TenantBranding created = new TenantBranding();
                    created.setTenant(tenantRepository.getReferenceById(tenantId));
                    return created;
                });
    }

    @Transactional
    public TenantBranding updateBranding(
            Long tenantId,
            String siteTitle,
            String primaryColor,
            String secondaryColor,
            String logoUrl,
            String umamiWebsiteId
    ) {
        TenantBranding branding = tenantBrandingRepository.findByTenantId(tenantId)
                .orElseGet(() -> {
                    TenantBranding created = new TenantBranding();
                    created.setTenant(tenantRepository.getReferenceById(tenantId));
                    return created;
                });
        if (siteTitle != null) {
            String trimmed = siteTitle.trim();
            branding.setSiteTitle(trimmed.isEmpty() ? null : trimmed);
        }
        if (primaryColor != null) {
            branding.setPrimaryColor(primaryColor);
        }
        if (secondaryColor != null) {
            branding.setSecondaryColor(secondaryColor);
        }
        if (logoUrl != null) {
            branding.setLogoUrl(logoUrl);
        }
        if (umamiWebsiteId != null) {
            branding.setUmamiWebsiteId(normalizeUmamiWebsiteId(umamiWebsiteId));
        }
        TenantBranding saved = tenantBrandingRepository.save(branding);
        cacheEviction.evictTenantPublicCachesAfterCommit(tenantId);
        return saved;
    }

    private static String normalizeUmamiWebsiteId(String umamiWebsiteId) {
        return UmamiWebsiteIdValidator.normalize(umamiWebsiteId);
    }
}
