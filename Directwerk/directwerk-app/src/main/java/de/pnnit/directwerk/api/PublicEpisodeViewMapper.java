package de.pnnit.directwerk.api;

import de.pnnit.directwerk.api.dto.CategoryView;
import de.pnnit.directwerk.api.dto.EpisodeView;
import de.pnnit.directwerk.api.dto.FormatView;
import de.pnnit.directwerk.api.dto.MeEpisodeView;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.dto.PublicEpisodeView;
import de.pnnit.directwerk.api.dto.PublicFormatView;
import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.service.EpisodeCoverResolver;
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
    private final EpisodeCoverResolver episodeCoverResolver;

    public PublicEpisodeView toPublicView(Episode episode) {
        String audioCdnUrl = null;
        if (PublicSurfacePolicy.exposesFullContent(episode.getAccessPolicy().name())
                && episode.getAudioAsset() != null) {
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
                        .map(PublicEpisodeViewMapper::toPublicFormatView)
                        .toList(),
                episode.getCategories().stream()
                        .sorted(CategoryView.DISPLAY_ORDER)
                        .map(PublicCategoryView::of)
                        .toList()
        );
    }

    public MeEpisodeView toPortalView(Episode episode, URL audioUrl) {
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

    public EpisodeView toStudioView(Episode episode) {
        // Same artwork rule as RSS enclosures (episode → format → series) and the same
        // public-only URL policy as list thumbnails: private covers stay null, editors
        // keep resolving those per asset through the media preview endpoint.
        String coverImageUrl = episodeCoverResolver.resolveCoverAsset(episode)
                .flatMap(episodeMediaApi::publicCdnUrl)
                .map(URL::toString)
                .orElse(null);
        return new EpisodeView(
                episode.getId(),
                episode.getSeries().getId(),
                episode.getSeries().getSlug(),
                episode.getEpisodeNumber(),
                episode.getSlug(),
                episode.getTitle(),
                episode.getDescription(),
                episode.getAudioAsset() != null ? episode.getAudioAsset().getId() : null,
                episode.getCoverAsset() != null ? episode.getCoverAsset().getId() : null,
                coverImageUrl,
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
                episode.getCreatedBy(),
                episode.getCreatedAt(),
                episode.getUpdatedAt()
        );
    }

    private static PublicFormatView toPublicFormatView(Format format) {
        return new PublicFormatView(
                format.getId(),
                format.getSlug(),
                format.getName(),
                format.getDescription(),
                format.getRequiredLevelSortOrder(),
                format.getSortOrder()
        );
    }

}
