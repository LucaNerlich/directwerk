package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.config.DirectwerkCacheNames;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.repository.TenantBrandingRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.UmamiHostUrlValidator;
import de.pnnit.directwerk.modules.core.util.UmamiWebsiteIdValidator;
import java.util.regex.Pattern;
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

    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");

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
            String umamiWebsiteId,
            String umamiHostUrl
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
            branding.setPrimaryColor(normalizeHexColor(primaryColor, "Primary color"));
        }
        if (secondaryColor != null) {
            branding.setSecondaryColor(normalizeHexColor(secondaryColor, "Secondary color"));
        }
        if (logoUrl != null) {
            branding.setLogoUrl(normalizeLogoUrl(logoUrl));
        }
        if (umamiWebsiteId != null) {
            branding.setUmamiWebsiteId(normalizeUmamiWebsiteId(umamiWebsiteId));
        }
        if (umamiHostUrl != null) {
            branding.setUmamiHostUrl(normalizeUmamiHostUrl(umamiHostUrl));
        }
        TenantBranding saved = tenantBrandingRepository.save(branding);
        cacheEviction.evictTenantPublicCachesAfterCommit(tenantId);
        return saved;
    }

    private static String normalizeUmamiWebsiteId(String umamiWebsiteId) {
        return UmamiWebsiteIdValidator.normalize(umamiWebsiteId);
    }

    /**
     * Brand colors render unescaped into inline {@code style} attributes on visitor-facing pages
     * and into email HTML ({@code background: {{primaryColor}}}), so only strict 6-digit hex
     * ({@code #rrggbb}) is accepted: anything else — a missing {@code #}, a 3-digit shorthand, a
     * named color, or a {@code ;}-laden CSS-injection payload — is rejected. Blank clears back to
     * null (same convention as {@code siteTitle}); null (absent) is handled by the caller, which
     * leaves the stored value untouched. Surrounding whitespace is trimmed so {@code " #112233 "}
     * still works for API integrators, while the stored value is always canonical.
     */
    private static String normalizeHexColor(String color, String fieldName) {
        String trimmed = color.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (!HEX_COLOR.matcher(trimmed).matches()) {
            throw new IllegalArgumentException(fieldName + " must be a 6-digit hex color like #112233");
        }
        return trimmed;
    }

    /**
     * Brand logos render as {@code <img src>} on every visitor-facing page, so only
     * absolute http/https URLs are accepted: {@code javascript:} / {@code data:} and
     * other schemes would turn a tenant-admin setting into stored XSS for the tenant's
     * visitors. Blank clears back to null (same convention as {@code siteTitle}).
     */
    private static String normalizeLogoUrl(String logoUrl) {
        String trimmed = logoUrl.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > 512) {
            throw new IllegalArgumentException("Logo URL must be at most 512 characters");
        }
        String scheme;
        try {
            scheme = new java.net.URI(trimmed).getScheme();
        } catch (IllegalArgumentException | java.net.URISyntaxException ex) {
            throw new IllegalArgumentException("Logo URL must be an absolute http(s) URL");
        }
        if (scheme == null || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
            throw new IllegalArgumentException("Logo URL must be an absolute http(s) URL");
        }
        return trimmed;
    }

    private static String normalizeUmamiHostUrl(String umamiHostUrl) {
        String normalized = UmamiHostUrlValidator.normalize(umamiHostUrl);
        if (normalized == null) {
            return null;
        }
        if (!UmamiHostUrlValidator.isValid(normalized)) {
            throw new IllegalArgumentException("Umami host URL must be an absolute HTTPS URL");
        }
        return normalized;
    }
}
