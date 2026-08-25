package de.pnnit.directwerk.controller.publicapi;

import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.service.PublicPodcastQueryService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.net.URL;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicPodcastController {

    private final PublicPodcastQueryService publicPodcastQueryService;
    private final ModuleGateService moduleGateService;
    private final EpisodeMediaApi episodeMediaApi;

    public PublicPodcastController(
            PublicPodcastQueryService publicPodcastQueryService,
            ModuleGateService moduleGateService,
            EpisodeMediaApi episodeMediaApi
    ) {
        this.publicPodcastQueryService = publicPodcastQueryService;
        this.moduleGateService = moduleGateService;
        this.episodeMediaApi = episodeMediaApi;
    }

    @GetMapping("/series")
    ResponseEntity<Response<List<PublicSeriesView>>> listSeries() {
        moduleGateService.requireModule(PodcastModule.KEY);
        Long tenantId = TenantContext.getTenantId();
        List<PublicSeriesView> series = publicPodcastQueryService.listPublishedSeries(tenantId).stream()
                .map(PublicPodcastController::toSeriesView)
                .toList();
        return ResponseEntity.ok(Response.ok(series));
    }

    @GetMapping("/episodes")
    ResponseEntity<Response<List<PublicEpisodeView>>> listEpisodes(
            @RequestParam(required = false) Long seriesId
    ) {
        moduleGateService.requireModule(PodcastModule.KEY);
        Long tenantId = TenantContext.getTenantId();
        List<PublicEpisodeView> episodes = publicPodcastQueryService
                .listPublishedEpisodes(tenantId, seriesId)
                .stream()
                .map(this::toEpisodeView)
                .toList();
        return ResponseEntity.ok(Response.ok(episodes));
    }

    @GetMapping("/formats")
    ResponseEntity<Response<List<PublicFormatView>>> listFormats() {
        moduleGateService.requireModule(PodcastModule.KEY);
        Long tenantId = TenantContext.getTenantId();
        List<PublicFormatView> formats = publicPodcastQueryService.listActiveFormats(tenantId).stream()
                .map(PublicPodcastController::toFormatView)
                .toList();
        return ResponseEntity.ok(Response.ok(formats));
    }

    @GetMapping("/categories")
    ResponseEntity<Response<List<PublicCategoryView>>> listCategories() {
        moduleGateService.requireModule(PodcastModule.KEY);
        Long tenantId = TenantContext.getTenantId();
        List<PublicCategoryView> categories = publicPodcastQueryService.listActiveCategories(tenantId).stream()
                .map(PublicPodcastController::toCategoryView)
                .toList();
        return ResponseEntity.ok(Response.ok(categories));
    }

    private static PublicSeriesView toSeriesView(PodcastSeries series) {
        return new PublicSeriesView(
                series.getId(),
                series.getSlug(),
                series.getTitle(),
                series.getDescription(),
                series.getCoverAsset() != null ? series.getCoverAsset().getId() : null,
                series.getLanguage(),
                series.getItunesCategory()
        );
    }

    private PublicEpisodeView toEpisodeView(Episode episode) {
        String audioCdnUrl = null;
        if (episode.getAccessPolicy() == AccessPolicy.FREE && episode.getAudioAsset() != null) {
            audioCdnUrl = episodeMediaApi.publicCdnUrl(episode.getAudioAsset())
                    .map(URL::toString)
                    .orElse(null);
        }
        return new PublicEpisodeView(
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
                audioCdnUrl,
                episode.getFormats().stream()
                        .sorted(Comparator.comparingInt(Format::getSortOrder).thenComparing(Format::getId))
                        .map(PublicPodcastController::toFormatView)
                        .toList(),
                episode.getCategories().stream()
                        .sorted(Comparator.comparing(Category::getName).thenComparing(Category::getId))
                        .map(PublicPodcastController::toCategoryView)
                        .toList()
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

    private static PublicCategoryView toCategoryView(Category category) {
        return new PublicCategoryView(
                category.getId(),
                category.getSlug(),
                category.getName(),
                category.getParent() != null ? category.getParent().getId() : null
        );
    }

    public record PublicSeriesView(
            Long id,
            String slug,
            String title,
            String description,
            Long coverAssetId,
            String language,
            String itunesCategory
    ) {
    }

    public record PublicEpisodeView(
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
            List<PublicFormatView> formats,
            List<PublicCategoryView> categories
    ) {
    }

    public record PublicFormatView(
            Long id,
            String slug,
            String name,
            String description,
            Integer requiredLevelSortOrder,
            int sortOrder
    ) {
    }
}
