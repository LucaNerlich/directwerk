package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeValidationException;
import de.pnnit.directwerk.modules.podcast.service.EpisodeDownloadAnalyticsService;
import de.pnnit.directwerk.modules.podcast.service.SubscriberEpisodeService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.URL;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PreAuthorize("isAuthenticated()")
@RequestMapping("/api/v1/me/episodes")
public class MeEpisodeController {

    private final SubscriberEpisodeService subscriberEpisodeService;
    private final ModuleGateService moduleGateService;
    private final AssetAccessApi assetAccessApi;
    private final EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService;

    public MeEpisodeController(
            SubscriberEpisodeService subscriberEpisodeService,
            ModuleGateService moduleGateService,
            AssetAccessApi assetAccessApi,
            EpisodeDownloadAnalyticsService episodeDownloadAnalyticsService
    ) {
        this.subscriberEpisodeService = subscriberEpisodeService;
        this.moduleGateService = moduleGateService;
        this.assetAccessApi = assetAccessApi;
        this.episodeDownloadAnalyticsService = episodeDownloadAnalyticsService;
    }

    @GetMapping
    ResponseEntity<Response<List<MeEpisodeView>>> listEpisodes(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        moduleGateService.requireModule(PodcastModule.KEY);

        List<Episode> episodes = isPublisher(user)
                ? subscriberEpisodeService.listPublishedEpisodes(user.tenantId())
                : subscriberEpisodeService.listEntitledEpisodes(user.tenantId(), user.userId());

        List<MeEpisodeView> views = episodes.stream()
                .map(episode -> toView(episode, user))
                .toList();
        return ResponseEntity.ok(Response.ok(views));
    }

    @GetMapping("/{slug}/stream")
    ResponseEntity<Void> streamEpisode(
            @PathVariable String slug,
            @AuthenticationPrincipal DirectwerkUserPrincipal principal,
            HttpServletRequest request
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        Long tenantId = TenantContext.requireTenantId();
        moduleGateService.requireModule(PodcastModule.KEY);

        Episode episode = subscriberEpisodeService.requirePublishedEpisode(tenantId, slug);
        MediaAsset audioAsset = episode.getAudioAsset();
        if (audioAsset == null || audioAsset.getStatus() != AssetStatus.READY) {
            throw new EpisodeValidationException("Episode audio asset must be READY");
        }

        URL url = resolvePlayableUrl(audioAsset, episode, user);
        episodeDownloadAnalyticsService.trackEpisodeDownload(tenantId, episode, "stream", request.getServerName());
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(url.toString()))
                .build();
    }

    private MeEpisodeView toView(Episode episode, DirectwerkUserPrincipal user) {
        String audioUrl = null;
        MediaAsset audioAsset = episode.getAudioAsset();
        if (audioAsset != null && audioAsset.getStatus() == AssetStatus.READY) {
            audioUrl = resolvePlayableUrl(audioAsset, episode, user).toString();
        }
        return new MeEpisodeView(
                episode.getId(),
                episode.getSeries().getId(),
                episode.getSeries().getSlug(),
                episode.getEpisodeNumber(),
                episode.getSlug(),
                episode.getTitle(),
                episode.getDescription(),
                episode.getDurationSeconds(),
                episode.getAccessPolicy().name(),
                episode.getRequiredLevelSortOrder(),
                episode.getPublishedAt(),
                audioUrl,
                episode.getFormats().stream()
                        .sorted(Comparator.comparingInt(Format::getSortOrder).thenComparing(Format::getId))
                        .map(MeEpisodeController::toFormatView)
                        .toList(),
                episode.getCategories().stream()
                        .sorted(Comparator.comparing(Category::getName).thenComparing(Category::getId))
                        .map(MeEpisodeController::toCategoryView)
                        .toList()
        );
    }

    private URL resolvePlayableUrl(MediaAsset audioAsset, Episode episode, DirectwerkUserPrincipal user) {
        // Editors/admins get in-tenant preview URLs (including private PAID audio).
        // Subscribers get entitlement-checked download/presign URLs.
        if (isPublisher(user)) {
            return assetAccessApi.resolvePreviewUrl(audioAsset, user, true);
        }
        if (episode.getAccessPolicy() == AccessPolicy.PAID) {
            moduleGateService.requireModule(SubscriptionModule.MODULE_KEY);
        }
        return assetAccessApi.resolveDownloadUrl(audioAsset, user);
    }

    private static boolean isPublisher(DirectwerkUserPrincipal user) {
        return user.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority ->
                        RoleConstants.EDITOR.equals(authority)
                                || RoleConstants.TENANT_ADMIN.equals(authority)
                );
    }

    private static FormatView toFormatView(Format format) {
        return new FormatView(
                format.getId(),
                format.getSlug(),
                format.getName(),
                format.getRequiredLevelSortOrder(),
                format.getSortOrder()
        );
    }

    private static CategoryView toCategoryView(Category category) {
        return new CategoryView(
                category.getId(),
                category.getSlug(),
                category.getName(),
                category.getParent() != null ? category.getParent().getId() : null
        );
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

    public record FormatView(Long id, String slug, String name, Integer requiredLevelSortOrder, int sortOrder) {
    }

    public record CategoryView(Long id, String slug, String name, Long parentId) {
    }
}
