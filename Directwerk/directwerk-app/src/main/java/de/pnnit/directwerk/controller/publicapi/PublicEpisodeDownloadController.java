package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.service.EpisodeDownloadAnalyticsService;
import de.pnnit.directwerk.modules.podcast.service.EpisodeEnclosureService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Legacy public download alias (same redirect + Umami tracking as {@code /feeds/.../e/{slug}.mp3}).
 */
@RestController
@RequestMapping("/api/v1/public/episodes")
public class PublicEpisodeDownloadController {

    private final EpisodeEnclosureService episodeEnclosureService;
    private final EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService;

    public PublicEpisodeDownloadController(
            EpisodeEnclosureService episodeEnclosureService,
            EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService
    ) {
        this.episodeEnclosureService = episodeEnclosureService;
        this.episodeDownloadAnalyticsService = episodeDownloadAnalyticsService;
    }

    @GetMapping("/{slug}/download")
    @RequiresModule(PodcastModule.KEY)
    ResponseEntity<Void> downloadEpisode(@PathVariable String slug, HttpServletRequest request) {
        Long tenantId = TenantContext.getTenantId();

        var redirect = episodeEnclosureService.resolvePublicRedirect(tenantId, slug);
        episodeDownloadAnalyticsService.trackEpisodeDownload(
                tenantId,
                redirect.episode(),
                "public-download",
                request.getServerName()
        );
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(redirect.targetUrl().toString()))
                .build();
    }
}
