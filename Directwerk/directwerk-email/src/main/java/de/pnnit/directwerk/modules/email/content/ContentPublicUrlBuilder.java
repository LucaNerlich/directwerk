package de.pnnit.directwerk.modules.email.content;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.ContentType;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class ContentPublicUrlBuilder {

    private static final String DEFAULT_PRIMARY_COLOR = "#2563eb";

    private final DirectwerkConfig directwerkConfig;
    private final TenantRepository tenantRepository;
    private final TenantDomainRepository tenantDomainRepository;

    public ContentPublicUrlBuilder(
            DirectwerkConfig directwerkConfig,
            TenantRepository tenantRepository,
            TenantDomainRepository tenantDomainRepository
    ) {
        this.directwerkConfig = directwerkConfig;
        this.tenantRepository = tenantRepository;
        this.tenantDomainRepository = tenantDomainRepository;
    }

    public String buildPublicContentUrl(Long tenantId, ContentType contentType, String slug) {
        String path = switch (contentType) {
            case EPISODE -> "/episodes/" + slug;
            case ARTICLE -> "/articles/" + slug;
        };
        return buildUrlWithPath(tenantId, path);
    }

    public String buildNotificationPreferencesUrl(Long tenantId) {
        return buildUrlWithPath(tenantId, "/account/notifications");
    }

    private String buildUrlWithPath(Long tenantId, String path) {
        return tenantDomainRepository.findByTenantId(tenantId).stream()
                .filter(TenantDomain::isPrimary)
                .filter(TenantDomain::isVerified)
                .map(domain -> "https://" + domain.getHost() + path)
                .findFirst()
                .orElseGet(() -> {
                    Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
                    String studioBase = trimTrailingSlash(directwerkConfig.email().studioBaseUrl());
                    if (tenant == null) {
                        return studioBase + path;
                    }
                    return studioBase + path + "?tenant=" + tenant.getSlug();
                });
    }

    private String resolveTenantBaseUrl(Long tenantId) {
        return buildUrlWithPath(tenantId, "");
    }

    private static String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return "https://localhost";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
