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
        try {
            if (tenantId == null
                    || episode == null
                    || hostname == null
                    || hostname.isBlank()
                    || !ALLOWED_SOURCES.contains(source)) {
                return;
            }
            String websiteId = resolveValidWebsiteId(tenantId);
            String hostUrl = resolveHostUrl(tenantId);
            if (websiteId == null || hostUrl == null) {
                return;
            }
            umamiEventClient.trackEvent(
                    hostUrl,
                    websiteId,
                    hostname.trim().toLowerCase(Locale.ROOT),
                    "/episodes/" + episode.getSlug(),
                    EVENT_NAME,
                    Map.of(
                            "episodeSlug", episode.getSlug(),
                            "seriesSlug", episode.getSeries().getSlug(),
                            "accessPolicy", episode.getAccessPolicy().name(),
                            "source", source
                    )
            );
        } catch (RuntimeException ex) {
            // Analytics is intentionally fail-open for episode playback.
        }
    }

    /**
     * Builds the public RSS enclosure URL for an episode.
     *
     * @param tenantId    the tenant identifier
     * @param scheme      the URL scheme
     * @param hostname    the request hostname
     * @param port        the request port
     * @param tenantSlug  the tenant slug
     * @param episodeSlug the episode slug
     * @return the public RSS enclosure URL
     */
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

    /**
     * Builds the private RSS enclosure URL for an episode.
     *
     * @param tenantId    the tenant identifier
     * @param scheme      the URL scheme
     * @param hostname    the host name
     * @param port        the network port
     * @param tenantSlug  the tenant slug
     * @param feedToken   the private feed token
     * @param episodeSlug the episode slug
     * @return the private RSS enclosure URL
     */
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

    private String resolveValidWebsiteId(Long tenantId) {
        if (tenantId == null || !moduleGateService.enabledModuleKeys(tenantId).contains(AnalyticsModule.KEY)) {
            return null;
        }
        TenantBranding branding = tenantBrandingService.getBranding(tenantId);
        String websiteId = branding.getUmamiWebsiteId();
        if (!UmamiWebsiteIdValidator.isValid(websiteId)) {
            return null;
        }
        return websiteId.trim();
    }

    private String resolveHostUrl(Long tenantId) {
        if (tenantId == null) {
            return null;
        }
        TenantBranding branding = tenantBrandingService.getBranding(tenantId);
        return UmamiAnalyticsResolver.resolveHostUrl(branding, directwerkConfig);
    }
}
