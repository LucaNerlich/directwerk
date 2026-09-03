package de.pnnit.directwerk.modules.core.analytics;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.util.UmamiHostUrlValidator;

public final class UmamiAnalyticsResolver {

    private UmamiAnalyticsResolver() {
    }

    /**
     * Resolves the Umami host for server-side events and public site-config.
     *
     * <p>Tenant override works independently of the platform kill-switch so tenants can
     * bring their own Umami even when no platform default is configured. A tenant host
     * that is syntactically valid but not publicly routable (loopback / private / reserved)
     * falls back to the platform host to avoid SSRF and dead-ends; callers must treat
     * {@code null} as tracking disabled (fail-open).
     */
    public static String resolveHostUrl(TenantBranding branding, DirectwerkConfig directwerkConfig) {
        if (branding != null && UmamiHostUrlValidator.isValid(branding.getUmamiHostUrl())) {
            String tenantHost = UmamiHostUrlValidator.normalize(branding.getUmamiHostUrl());
            if (UmamiHostUrlValidator.hasPubliclyRoutableHost(tenantHost)) {
                return tenantHost;
            }
            // Non-routable tenant host (localhost, private IP, reserved): fall through to platform.
        }
        if (directwerkConfig.isAnalyticsEnabled()) {
            DirectwerkProperties.Analytics analytics = directwerkConfig.analytics();
            if (analytics != null && UmamiHostUrlValidator.isValid(analytics.umamiHostUrl())) {
                return UmamiHostUrlValidator.normalize(analytics.umamiHostUrl());
            }
        }
        return null;
    }

    /**
     * Selects the host candidate for a server-side event without resolving DNS on the request
     * thread. {@link UmamiEventClient} validates and pins the destination in its executor before
     * opening the connection.
     */
    public static String resolveEventHostUrl(TenantBranding branding, DirectwerkConfig directwerkConfig) {
        if (branding != null
                && UmamiHostUrlValidator.isValid(branding.getUmamiHostUrl())
                && !UmamiHostUrlValidator.hasObviouslyNonPublicHost(branding.getUmamiHostUrl())) {
            return UmamiHostUrlValidator.normalize(branding.getUmamiHostUrl());
        }
        if (directwerkConfig.isAnalyticsEnabled()) {
            DirectwerkProperties.Analytics analytics = directwerkConfig.analytics();
            if (analytics != null && UmamiHostUrlValidator.isValid(analytics.umamiHostUrl())) {
                return UmamiHostUrlValidator.normalize(analytics.umamiHostUrl());
            }
        }
        return null;
    }
}
