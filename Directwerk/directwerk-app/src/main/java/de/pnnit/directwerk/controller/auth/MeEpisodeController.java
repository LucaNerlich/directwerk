package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.PublicEpisodeViewMapper;
import de.pnnit.directwerk.api.dto.CategoryView;
import de.pnnit.directwerk.api.dto.FormatView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.access.SubscriberPortalAccessService;
import de.pnnit.directwerk.modules.podcast.service.PortalStreamDeliveryFacade;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PreAuthorize("isAuthenticated()")
@RequestMapping("/api/v1/me/episodes")
public class MeEpisodeController {

    private final SubscriberPortalAccessService subscriberContentAccessService;
    private final PortalStreamDeliveryFacade portalStreamDeliveryFacade;
    private final PublicEpisodeViewMapper publicEpisodeViewMapper;

    public MeEpisodeController(
            SubscriberPortalAccessService subscriberContentAccessService,
            PortalStreamDeliveryFacade portalStreamDeliveryFacade,
            PublicEpisodeViewMapper publicEpisodeViewMapper
    ) {
        this.subscriberContentAccessService = subscriberContentAccessService;
        this.portalStreamDeliveryFacade = portalStreamDeliveryFacade;
        this.publicEpisodeViewMapper = publicEpisodeViewMapper;
    }

    @GetMapping
    @RequiresModule(PodcastModule.KEY)
    ResponseEntity<Response<List<MeEpisodeView>>> listEpisodes(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        // Publisher branch, entitlement filter and per-episode URL resolution live in the
        // access module.
        List<MeEpisodeView> views = subscriberContentAccessService.listMyEpisodes(user).stream()
                .map(stream -> publicEpisodeViewMapper.toPortalView(stream.episode(), stream.url()))
                .toList();
        return ResponseEntity.ok(Response.ok(views));
    }

    @GetMapping("/{slug}/stream")
    @RequiresModule(PodcastModule.KEY)
    ResponseEntity<Void> streamEpisode(
            @PathVariable String slug,
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);

        // Gate ordering, READY check, publisher branch and PAID⇒SUBSCRIPTION live in the
        // access module — see SubscriberPortalAccessService.
        var tracked = portalStreamDeliveryFacade.streamEpisode(user, slug, request.getServerName());
        return tracked.response();
    }

    public record MeEpisodeView(
            Long id,
            Long seriesId,
            String seriesSlug,
            Integer episodeNumber,
            String slug,
            String title,
            String description,
            Integer durationSeconds,
            String accessPolicy,
            Integer requiredLevelSortOrder,
            Instant publishedAt,
            String audioCdnUrl,
            List<FormatView> formats,
            List<CategoryView> categories
    ) {
    }
}
