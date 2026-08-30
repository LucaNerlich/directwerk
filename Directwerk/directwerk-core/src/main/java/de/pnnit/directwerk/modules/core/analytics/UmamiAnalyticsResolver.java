package de.pnnit.directwerk.modules.core.analytics;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.util.UmamiHostUrlValidator;

public final class UmamiAnalyticsResolver {

    private UmamiAnalyticsResolver() {
    }

    public static String resolveHostUrl(TenantBranding branding, DirectwerkConfig directwerkConfig) {
        if (branding != null && UmamiHostUrlValidator.isValid(branding.getUmamiHostUrl())) {
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
