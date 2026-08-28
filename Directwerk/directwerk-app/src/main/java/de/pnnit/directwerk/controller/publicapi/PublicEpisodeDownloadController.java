package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.service.RssFeedDeliveryFacade;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
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

    private final RssFeedDeliveryFacade rssFeedDeliveryFacade;

    public PublicEpisodeDownloadController(RssFeedDeliveryFacade rssFeedDeliveryFacade) {
        this.rssFeedDeliveryFacade = rssFeedDeliveryFacade;
    }

    @GetMapping("/{slug}/download")
    @RequiresModule(PodcastModule.KEY)
    ResponseEntity<Void> downloadEpisode(@PathVariable String slug, HttpServletRequest request) {
        Long tenantId = TenantContext.getTenantId();
        return rssFeedDeliveryFacade.publicEnclosure(
                tenantId,
                slug,
                "public-download",
                request.getServerName()
        ).response();
    }
}
