package de.pnnit.directwerk.modules.core.analytics;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.AnalyticsModule;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.core.util.UmamiWebsiteIdValidator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Counts RSS feed XML fetches (podcast + article, public + private). Enclosure / article-view
 * events measure consumption; feed-fetch measures reach/subscriber polling even when bodies
 * are read offline from the snapshot. Fail-open: never gates feed delivery.
 */
@Service
@RequiredArgsConstructor
public class FeedFetchAnalyticsService {

    private static final String EVENT_NAME = "feed-fetch";
    private static final Set<String> ALLOWED_KINDS = Set.of("podcast", "article");
    private static final Set<String> ALLOWED_VISIBILITY = Set.of("public", "private");

    private final DirectwerkConfig directwerkConfig;
    private final ModuleGateService moduleGateService;
    private final TenantBrandingService tenantBrandingService;
    private final UmamiEventClient umamiEventClient;

    @Transactional(readOnly = true)
    public void trackFeedFetch(
            Long tenantId,
            String feedKind,
            String visibility,
            String hostname
    ) {
        trackFeedFetch(tenantId, feedKind, visibility, hostname, null);
    }

    @Transactional(readOnly = true)
    public void trackFeedFetch(
            Long tenantId,
            String feedKind,
            String visibility,
            String hostname,
            String clientUserAgent
    ) {
        try {
            if (tenantId == null
                    || hostname == null
                    || hostname.isBlank()
                    || !ALLOWED_KINDS.contains(feedKind)
                    || !ALLOWED_VISIBILITY.contains(visibility)) {
                return;
            }
            if (!moduleGateService.enabledModuleKeys(tenantId).contains(AnalyticsModule.KEY)) {
                return;
            }
            TenantBranding branding = tenantBrandingService.getBranding(tenantId);
            String websiteId = branding.getUmamiWebsiteId();
            if (!UmamiWebsiteIdValidator.isValid(websiteId)) {
                return;
            }
            String hostUrl = UmamiAnalyticsResolver.resolveHostUrl(branding, directwerkConfig);
            if (hostUrl == null) {
                return;
            }
            umamiEventClient.trackEvent(
                    hostUrl,
                    websiteId.trim(),
                    hostname.trim().toLowerCase(Locale.ROOT),
                    "/feeds/" + feedKind,
                    EVENT_NAME,
                    Map.of(
                            "feedKind", feedKind,
                            "visibility", visibility,
                            "clientUserAgent", truncate(clientUserAgent)
                    )
            );
        } catch (RuntimeException ex) {
            // Analytics is intentionally fail-open for feed delivery.
        }
    }

    private static String truncate(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.length() > 256 ? trimmed.substring(0, 256) : trimmed;
    }
}
