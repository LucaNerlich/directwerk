package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.PublicEpisodeViewMapper;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.dto.PublicEpisodeView;
import de.pnnit.directwerk.api.dto.PublicFormatView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.util.FeedUrlResolver;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.service.PublicPodcastQueryService;
import de.pnnit.directwerk.modules.podcast.service.RssFeedSnapshotService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
@RequiresModule(PodcastModule.KEY)
public class PublicPodcastController {

    private final PublicPodcastQueryService publicPodcastQueryService;
    private final PublicEpisodeViewMapper publicEpisodeViewMapper;
    private final RssFeedSnapshotService rssFeedSnapshotService;
    private final FeedUrlResolver feedUrlResolver;

    public PublicPodcastController(
            PublicPodcastQueryService publicPodcastQueryService,
            PublicEpisodeViewMapper publicEpisodeViewMapper,
            RssFeedSnapshotService rssFeedSnapshotService,
            FeedUrlResolver feedUrlResolver
    ) {
        this.publicPodcastQueryService = publicPodcastQueryService;
        this.publicEpisodeViewMapper = publicEpisodeViewMapper;
        this.rssFeedSnapshotService = rssFeedSnapshotService;
        this.feedUrlResolver = feedUrlResolver;
    }

    @GetMapping("/series")
    ResponseEntity<Response<List<PublicSeriesView>>> listSeries(HttpServletRequest request) {
        Long tenantId = TenantContext.getTenantId();
        String tenantSlug = rssFeedSnapshotService.publicRssTenantSlug(tenantId).orElse(null);
        List<PublicSeriesView> series = publicPodcastQueryService.listPublishedSeries(tenantId).stream()
                .map(item -> toSeriesView(item, request, tenantSlug))
                .toList();
        return ResponseEntity.ok(Response.ok(series));
    }

    @GetMapping("/episodes")
    ResponseEntity<Response<List<PublicEpisodeView>>> listEpisodes(
            @RequestParam(required = false) Long seriesId
    ) {
        Long tenantId = TenantContext.getTenantId();
        List<PublicEpisodeView> episodes = publicPodcastQueryService
                .listPublishedEpisodes(tenantId, seriesId)
                .stream()
                .map(publicEpisodeViewMapper::toPublicView)
                .toList();
        return ResponseEntity.ok(Response.ok(episodes));
    }

    @GetMapping("/formats")
    ResponseEntity<Response<List<PublicFormatView>>> listFormats() {
        Long tenantId = TenantContext.getTenantId();
        List<PublicFormatView> formats = publicPodcastQueryService.listActiveFormats(tenantId).stream()
                .map(PublicPodcastController::toFormatView)
                .toList();
        return ResponseEntity.ok(Response.ok(formats));
    }

    @GetMapping("/categories")
    ResponseEntity<Response<List<PublicCategoryView>>> listCategories() {
        Long tenantId = TenantContext.getTenantId();
        List<PublicCategoryView> categories = publicPodcastQueryService.listActiveCategories(tenantId).stream()
                .map(PublicCategoryView::of)
                .toList();
        return ResponseEntity.ok(Response.ok(categories));
    }

    private PublicSeriesView toSeriesView(PodcastSeries series, HttpServletRequest request, String tenantSlug) {
        String rssUrl = null;
        if (tenantSlug != null) {
            rssUrl = feedUrlResolver.seriesFeedUrl(
                    request.getScheme(),
                    request.getServerName(),
                    request.getServerPort(),
                    tenantSlug,
                    series.getSlug()
            );
        }
        return new PublicSeriesView(
                series.getId(),
                series.getSlug(),
                series.getTitle(),
                series.getDescription(),
                series.getCoverAsset() != null ? series.getCoverAsset().getId() : null,
                series.getLanguage(),
                series.getItunesCategory(),
                rssUrl
        );
    }

    private static PublicFormatView toFormatView(Format format) {
        return new PublicFormatView(
                format.getId(),
                format.getSlug(),
                format.getName(),
                format.getDescription(),
                format.getRequiredLevelSortOrder(),
                format.getSortOrder()
        );
    }


    public record PublicSeriesView(
            Long id,
            String slug,
            String title,
            String description,
            Long coverAssetId,
            String language,
            String itunesCategory,
            String rssUrl
    ) {
    }
}
