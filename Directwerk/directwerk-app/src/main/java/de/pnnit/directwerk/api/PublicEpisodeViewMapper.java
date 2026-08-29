package de.pnnit.directwerk.api;

import de.pnnit.directwerk.api.dto.CategoryView;
import de.pnnit.directwerk.api.dto.FormatView;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.controller.podcast.EpisodeController;
import de.pnnit.directwerk.controller.publicapi.PublicPodcastController;
import de.pnnit.directwerk.controller.auth.MeEpisodeController;
import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import java.net.URL;
import java.util.Comparator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Shared Episode → API view mapping for public site, subscriber portal, and studio.
 */
@Component
@RequiredArgsConstructor
public class PublicEpisodeViewMapper {

    private final EpisodeMediaApi episodeMediaApi;

    public PublicPodcastController.PublicEpisodeView toPublicView(Episode episode) {
        String audioCdnUrl = null;
        if (PublicSurfacePolicy.exposesFullContent(episode.getAccessPolicy().name())
                && episode.getAudioAsset() != null) {
            audioCdnUrl = episodeMediaApi.publicCdnUrl(episode.getAudioAsset())
                    .map(URL::toString)
                    .orElse(null);
        }
        return new PublicPodcastController.PublicEpisodeView(
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
                        .map(PublicEpisodeViewMapper::toPublicFormatView)
                        .toList(),
                episode.getCategories().stream()
                        .sorted(CategoryView.DISPLAY_ORDER)
                        .map(PublicCategoryView::of)
                        .toList()
        );
    }

    public MeEpisodeController.MeEpisodeView toPortalView(Episode episode, URL audioUrl) {
        return new MeEpisodeController.MeEpisodeView(
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
                audioUrl != null ? audioUrl.toString() : null,
                episode.getFormats().stream()
                        .sorted(FormatView.DISPLAY_ORDER)
                        .map(FormatView::of)
                        .toList(),
                episode.getCategories().stream()
                        .sorted(CategoryView.DISPLAY_ORDER)
                        .map(CategoryView::of)
                        .toList()
        );
    }

    public EpisodeController.EpisodeView toStudioView(Episode episode) {
        return new EpisodeController.EpisodeView(
                episode.getId(),
                episode.getSeries().getId(),
                episode.getSeries().getSlug(),
                episode.getEpisodeNumber(),
                episode.getSlug(),
                episode.getTitle(),
                episode.getDescription(),
                episode.getAudioAsset() != null ? episode.getAudioAsset().getId() : null,
                episode.getDurationSeconds(),
                episode.getAccessPolicy().name(),
                episode.getRequiredLevelSortOrder(),
                episode.getStatus().name(),
                episode.isEnclosureEnabled(),
                episode.getPublishedAt(),
                episode.getScheduledAt(),
                episode.getFormats().stream()
                        .sorted(FormatView.DISPLAY_ORDER)
                        .map(FormatView::of)
                        .toList(),
                episode.getCategories().stream()
                        .sorted(CategoryView.DISPLAY_ORDER)
                        .map(CategoryView::of)
                        .toList(),
                episode.getCreatedAt(),
                episode.getUpdatedAt()
        );
    }

    private static PublicPodcastController.PublicFormatView toPublicFormatView(Format format) {
        return new PublicPodcastController.PublicFormatView(
                format.getId(),
                format.getSlug(),
                format.getName(),
                format.getDescription(),
                format.getRequiredLevelSortOrder(),
                format.getSortOrder()
        );
    }

}
