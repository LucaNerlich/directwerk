package de.pnnit.directwerk.modules.core.analytics;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.AnalyticsModule;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.core.util.UmamiWebsiteIdValidator;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single deep seam for server-side Umami event emission.
 *
 * <p>Owns the pipeline that used to be duplicated across {@code FeedFetchAnalyticsService},
 * {@code EpisodeDownloadAnalyticsService} and {@code ArticleViewAnalyticsService}: the ANALYTICS
 * module gate, tenant branding lookup, website-ID validation, event host resolution, hostname
 * normalization, client user-agent truncation, the {@link UmamiEventClient} call and the
 * fail-open guard. Callers validate their own event-specific preconditions, build the dimension
 * map and delegate here.
 *
 * <p>Analytics is intentionally fail-open: no exception raised by this pipeline may affect the
 * request that triggered it.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class TenantEventTracker {

    private static final int MAX_USER_AGENT_LENGTH = 256;

    private final DirectwerkConfig directwerkConfig;
    private final ModuleGateService moduleGateService;
    private final TenantBrandingService tenantBrandingService;
    private final UmamiEventClient umamiEventClient;

    /**
     * Emits {@code eventName} for {@code tenantId} without skip logging.
     *
     * @return {@code true} when the event was handed to {@link UmamiEventClient}, {@code false}
     *         when a precondition (blank hostname, module off, invalid website ID, no host)
     *         made tracking a no-op.
     */
    public boolean track(
            Long tenantId,
            String eventName,
            String path,
            String hostname,
            Map<String, String> data,
            String userAgent,
            String clientIp
    ) {
        return track(tenantId, eventName, path, hostname, data, userAgent, clientIp, null);
    }

    /**
     * Emits {@code eventName} for {@code tenantId}. When {@code logSubject} is non-null, skipped
     * events are logged at INFO with the event-specific subject wording callers rely on;
     * {@code null} keeps the silent skip used by the feed-fetch and article-view adapters.
     */
    @Transactional(readOnly = true)
    public boolean track(
            Long tenantId,
            String eventName,
            String path,
            String hostname,
            Map<String, String> data,
            String userAgent,
            String clientIp,
            String logSubject
    ) {
        try {
            if (tenantId == null || hostname == null || hostname.isBlank()) {
                return false;
            }
            if (!moduleGateService.enabledModuleKeys(tenantId).contains(AnalyticsModule.KEY)) {
                if (logSubject != null) {
                    log.info(
                            "Skipping {} event for tenant {} {}: ANALYTICS module is not enabled",
                            eventName,
                            tenantId,
                            logSubject);
                }
                return false;
            }
            TenantBranding branding = tenantBrandingService.getBranding(tenantId);
            String websiteId = branding.getUmamiWebsiteId();
            if (!UmamiWebsiteIdValidator.isValid(websiteId)) {
                if (logSubject != null) {
                    log.info(
                            "Skipping {} event for tenant {} {}: no valid Umami website ID configured",
                            eventName,
                            tenantId,
                            logSubject);
                }
                return false;
            }
            String hostUrl = UmamiAnalyticsResolver.resolveEventHostUrl(branding, directwerkConfig);
            if (hostUrl == null) {
                if (logSubject != null) {
                    log.info(
                            "Skipping {} event for tenant {} {}: no Umami host resolvable (tenant override unset, platform analytics disabled)",
                            eventName,
                            tenantId,
                            logSubject);
                }
                return false;
            }
            umamiEventClient.trackEvent(
                    hostUrl,
                    websiteId.trim(),
                    hostname.trim().toLowerCase(Locale.ROOT),
                    path,
                    eventName,
                    payload(data, userAgent),
                    clientIp);
            return true;
        } catch (RuntimeException ex) {
            // Analytics is intentionally fail-open for the triggering request.
            return false;
        }
    }

    private static Map<String, Object> payload(Map<String, String> data, String userAgent) {
        Map<String, Object> payload = new HashMap<>();
        if (data != null) {
            payload.putAll(data);
        }
        payload.put("clientUserAgent", truncate(userAgent));
        return payload;
    }

    private static String truncate(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.length() > MAX_USER_AGENT_LENGTH
                ? trimmed.substring(0, MAX_USER_AGENT_LENGTH)
                : trimmed;
    }
}
