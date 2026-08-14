package de.pnnit.directwerk.modules.subscription.stripe;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import java.net.URI;
import java.util.Locale;
import org.springframework.stereotype.Component;

/**
 * Restricts Stripe return/success/cancel URLs to tenant domains, the studio origin, or loopback.
 */
@Component
public class BillingRedirectUrlValidator {

    private final TenantDomainRepository tenantDomainRepository;
    private final DirectwerkConfig directwerkConfig;

    public BillingRedirectUrlValidator(
            TenantDomainRepository tenantDomainRepository,
            DirectwerkConfig directwerkConfig
    ) {
        this.tenantDomainRepository = tenantDomainRepository;
        this.directwerkConfig = directwerkConfig;
    }

    public String requireAllowedUrl(Long tenantId, String rawUrl, String fieldName) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        URI uri;
        try {
            uri = URI.create(rawUrl.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(fieldName + " is not a valid URL");
        }
        if (!uri.isAbsolute() || uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException(fieldName + " must be an absolute URL with a host");
        }
        if (uri.getUserInfo() != null) {
            throw new IllegalArgumentException(fieldName + " must not include user info");
        }
        if (uri.getRawFragment() != null) {
            throw new IllegalArgumentException(fieldName + " must not include a fragment");
        }
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        boolean loopback = isLoopbackHost(host);
        if (loopback) {
            if (!"http".equals(scheme) && !"https".equals(scheme)) {
                throw new IllegalArgumentException(fieldName + " must use http or https");
            }
        } else if (!"https".equals(scheme)) {
            throw new IllegalArgumentException(fieldName + " must use HTTPS");
        }
        if (!loopback && !isTenantHost(tenantId, host) && !isStudioHost(host)) {
            throw new IllegalArgumentException(fieldName + " host is not allowed for this tenant");
        }
        String path = uri.getRawPath();
        if (path == null || !path.startsWith("/")) {
            throw new IllegalArgumentException(fieldName + " must include a path");
        }
        return uri.toString();
    }

    public String defaultPublicUrl(Long tenantId, String path) {
        return tenantDomainRepository.findByTenantId(tenantId).stream()
                .filter(TenantDomain::isPrimary)
                .findFirst()
                .or(() -> tenantDomainRepository.findByTenantId(tenantId).stream().findFirst())
                .map(domain -> publicOrigin(domain.getHost()) + path)
                .orElseThrow(() -> new IllegalArgumentException("Tenant has no domain for billing redirects"));
    }

    public String defaultStudioUrl(String path) {
        String base = directwerkConfig.email() != null ? directwerkConfig.email().studioBaseUrl() : null;
        if (base == null || base.isBlank()) {
            throw new IllegalArgumentException("Studio base URL is not configured");
        }
        return trimTrailingSlash(base) + path;
    }

    private boolean isTenantHost(Long tenantId, String host) {
        return tenantDomainRepository.findByTenantIdAndHostIgnoreCase(tenantId, host).isPresent();
    }

    private boolean isStudioHost(String host) {
        String base = directwerkConfig.email() != null ? directwerkConfig.email().studioBaseUrl() : null;
        if (base == null || base.isBlank()) {
            return false;
        }
        try {
            URI studio = URI.create(base);
            return studio.getHost() != null && host.equalsIgnoreCase(studio.getHost());
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static boolean isLoopbackHost(String host) {
        return "localhost".equals(host)
                || host.endsWith(".localhost")
                || "127.0.0.1".equals(host)
                || "[::1]".equals(host);
    }

    private static String publicOrigin(String host) {
        if (isLoopbackHost(host.toLowerCase(Locale.ROOT))) {
            return "http://" + host;
        }
        return "https://" + host;
    }

    private static String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
