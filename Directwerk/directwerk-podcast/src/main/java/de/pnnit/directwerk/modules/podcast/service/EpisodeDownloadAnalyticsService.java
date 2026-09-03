package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.AnalyticsModule;
import de.pnnit.directwerk.modules.core.analytics.UmamiAnalyticsResolver;
import de.pnnit.directwerk.modules.core.analytics.UmamiEventClient;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.core.util.UmamiWebsiteIdValidator;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EpisodeDownloadAnalyticsService {

    private static final String EVENT_NAME = "episode-download";
    private static final Set<String> ALLOWED_SOURCES = Set.of(
            "stream",
            "public-download",
            "public-rss",
            "private-rss"
    );

    private final DirectwerkConfig directwerkConfig;
    private final ModuleGateService moduleGateService;
    private final TenantBrandingService tenantBrandingService;
    private final UmamiEventClient umamiEventClient;
    private final EpisodeEnclosureService episodeEnclosureService;

    @Transactional(readOnly = true)
    public void trackEpisodeDownload(Long tenantId, Episode episode, String source, String hostname) {
        trackEpisodeDownload(tenantId, episode, source, hostname, null, false);
    }

    @Transactional(readOnly = true)
    public void trackEpisodeDownload(
            Long tenantId,
            Episode episode,
            String source,
            String hostname,
            String clientUserAgent,
            boolean isRangeRequest
    ) {
        try {
            if (tenantId == null
                    || episode == null
                    || episode.getSlug() == null
                    || hostname == null
                    || hostname.isBlank()
                    || !ALLOWED_SOURCES.contains(source)) {
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
            String seriesSlug = episode.getSeries() != null ? episode.getSeries().getSlug() : null;
            umamiEventClient.trackEvent(
                    hostUrl,
                    websiteId.trim(),
                    hostname.trim().toLowerCase(Locale.ROOT),
                    "/episodes/" + episode.getSlug(),
                    EVENT_NAME,
                    Map.of(
                            "episodeSlug", episode.getSlug(),
                            "seriesSlug", seriesSlug != null ? seriesSlug : "",
                            "accessPolicy", episode.getAccessPolicy().name(),
                            "source", source,
                            "isRangeRequest", isRangeRequest ? "true" : "false",
                            "clientUserAgent", truncate(clientUserAgent)
                    )
            );
        } catch (RuntimeException ex) {
            // Analytics is intentionally fail-open for episode playback.
        }
    }

    public String publicRssEnclosureUrl(
            Long tenantId,
            String scheme,
            String hostname,
            int port,
            String tenantSlug,
            String episodeSlug
    ) {
        return episodeEnclosureService.publicEnclosureUrl(tenantId, scheme, hostname, port, tenantSlug, episodeSlug);
    }

    public String privateRssEnclosureUrl(
            Long tenantId,
            String scheme,
            String hostname,
            int port,
            String tenantSlug,
            String feedToken,
            String episodeSlug
    ) {
        return episodeEnclosureService.privateEnclosureUrl(
                tenantId,
                scheme,
                hostname,
                port,
                tenantSlug,
                feedToken,
                episodeSlug
        );
    }

    private static String truncate(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.length() > 256 ? trimmed.substring(0, 256) : trimmed;
    }
}
