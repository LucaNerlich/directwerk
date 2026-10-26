package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.analytics.TenantEventTracker;
import de.pnnit.directwerk.modules.core.analytics.UmamiEventClient;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import java.util.LinkedHashMap;
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
                || episode.getSlug().isBlank()
                || episode.getAccessPolicy() == null
                || hostname == null
                || hostname.isBlank()
                || !ALLOWED_SOURCES.contains(source)) {
            log.debug("Skipping episode-download event: incomplete request context (source={})", source);
            return;
        }
        String episodeSlug = episode.getSlug().trim();
        String episodeTitle = episode.getTitle() != null ? episode.getTitle().trim() : "";
        String seriesSlug = episode.getSeries() != null ? episode.getSeries().getSlug() : null;
        Map<String, String> data = new LinkedHashMap<>();
        data.put("episodeSlug", episodeSlug);
        if (episode.getId() != null) {
            data.put("episodeId", String.valueOf(episode.getId()));
        }
        if (!episodeTitle.isEmpty()) {
            data.put("episodeTitle", truncateProp(episodeTitle));
        }
        if (seriesSlug != null && !seriesSlug.isBlank()) {
            data.put("seriesSlug", seriesSlug.trim());
        }
        data.put("accessPolicy", episode.getAccessPolicy().name());
        data.put("source", source);
        data.put("isRangeRequest", isRangeRequest ? "true" : "false");
        // title → Umami page_title; tag → first-class Events filter (Umami tag max 50).
        // Custom props also stay in data so the Properties tab can break down by episode.
        String tag = episodeSlug.length() <= 50 ? episodeSlug : episodeSlug.substring(0, 50);
        tenantEventTracker.track(
                tenantId,
                EVENT_NAME,
                "/episodes/" + episodeSlug,
                hostname,
                data,
                clientUserAgent,
                clientIp,
                "episode '" + episodeSlug + "'",
                episodeTitle.isEmpty() ? episodeSlug : truncateProp(episodeTitle),
                tag);
    }

    /** Umami event-data string values cap at 500; keep titles comfortably under that. */
    private static String truncateProp(String value) {
        return value.length() > 200 ? value.substring(0, 200) : value;
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
