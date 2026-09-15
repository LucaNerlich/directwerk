package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.analytics.TenantEventTracker;
import de.pnnit.directwerk.modules.core.analytics.UmamiEventClient;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Podcast consumption analytics. Event-specific validation and dimension building stay here; the
 * shared Umami emission pipeline lives in {@link TenantEventTracker}. Fail-open for episode
 * playback.
 */
@Service
@Slf4j
public class EpisodeDownloadAnalyticsService {

    private static final String EVENT_NAME = "episode-download";
    private static final Set<String> ALLOWED_SOURCES = Set.of(
            "stream",
            "public-download",
            "public-rss",
            "private-rss"
    );

    private final TenantEventTracker tenantEventTracker;
    private final EpisodeEnclosureService episodeEnclosureService;

    @Autowired
    public EpisodeDownloadAnalyticsService(
            TenantEventTracker tenantEventTracker,
            EpisodeEnclosureService episodeEnclosureService
    ) {
        this.tenantEventTracker = tenantEventTracker;
        this.episodeEnclosureService = episodeEnclosureService;
    }

    /**
     * Retained for direct instantiation by same-package unit tests; production wiring injects the
     * shared {@link TenantEventTracker} bean instead.
     */
    EpisodeDownloadAnalyticsService(
            DirectwerkConfig directwerkConfig,
            ModuleGateService moduleGateService,
            TenantBrandingService tenantBrandingService,
            UmamiEventClient umamiEventClient,
            EpisodeEnclosureService episodeEnclosureService
    ) {
        this.tenantEventTracker = new TenantEventTracker(
                directwerkConfig, moduleGateService, tenantBrandingService, umamiEventClient);
        this.episodeEnclosureService = episodeEnclosureService;
    }

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
        trackEpisodeDownload(tenantId, episode, source, hostname, clientUserAgent, isRangeRequest, null);
    }

    @Transactional(readOnly = true)
    public void trackEpisodeDownload(
            Long tenantId,
            Episode episode,
            String source,
            String hostname,
            String clientUserAgent,
            boolean isRangeRequest,
            String clientIp
    ) {
        if (tenantId == null
                || episode == null
                || episode.getSlug() == null
                || hostname == null
                || hostname.isBlank()
                || !ALLOWED_SOURCES.contains(source)) {
            log.debug("Skipping episode-download event: incomplete request context (source={})", source);
            return;
        }
        String seriesSlug = episode.getSeries() != null ? episode.getSeries().getSlug() : null;
        tenantEventTracker.track(
                tenantId,
                EVENT_NAME,
                "/episodes/" + episode.getSlug(),
                hostname,
                Map.of(
                        "episodeSlug", episode.getSlug(),
                        "seriesSlug", seriesSlug != null ? seriesSlug : "",
                        "accessPolicy", episode.getAccessPolicy().name(),
                        "source", source,
                        "isRangeRequest", isRangeRequest ? "true" : "false"),
                clientUserAgent,
                clientIp,
                "episode '" + episode.getSlug() + "'");
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
}
