package de.pnnit.directwerk.api;

import de.pnnit.directwerk.api.dto.CategoryView;
import de.pnnit.directwerk.api.dto.EpisodeView;
import de.pnnit.directwerk.api.dto.FormatView;
import de.pnnit.directwerk.api.dto.MeEpisodeView;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.dto.PublicEpisodeView;
import de.pnnit.directwerk.api.dto.PublicFormatView;
import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.content.WorkingDraftMaps;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.exception.FormatNotFoundException;
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
import de.pnnit.directwerk.modules.podcast.service.EpisodeCoverResolver;
import java.net.URL;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private final CategoryService categoryService;
    private final FormatRepository formatRepository;

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
                resolvePublicCoverImageUrl(episode),
                episode.getFormats().stream()
                        // Issue #381: single definition of "canonical format order".
                        .sorted(FormatView.DISPLAY_ORDER)
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
                resolvePublicCoverImageUrl(episode),
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
        Map<String, Object> draft = episode.getWorkingDraft();
        boolean hasDraft = WorkingDraftMaps.isPresent(draft);

        Integer episodeNumber = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.EPISODE_NUMBER)
                ? WorkingDraftMaps.getInteger(draft, WorkingDraftMaps.EPISODE_NUMBER)
                : episode.getEpisodeNumber();
        String slug = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.SLUG)
                ? WorkingDraftMaps.getString(draft, WorkingDraftMaps.SLUG)
                : episode.getSlug();
        String title = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.TITLE)
                ? WorkingDraftMaps.getString(draft, WorkingDraftMaps.TITLE)
                : episode.getTitle();
        String description = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.DESCRIPTION)
                ? WorkingDraftMaps.getString(draft, WorkingDraftMaps.DESCRIPTION)
                : episode.getDescription();
        Long audioAssetId = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.AUDIO_ASSET_ID)
                ? WorkingDraftMaps.getLong(draft, WorkingDraftMaps.AUDIO_ASSET_ID)
                : (episode.getAudioAsset() != null ? episode.getAudioAsset().getId() : null);
        Long coverAssetId = resolveStudioCoverAssetId(episode, draft, hasDraft);
        Integer durationSeconds = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.DURATION_SECONDS)
                ? WorkingDraftMaps.getInteger(draft, WorkingDraftMaps.DURATION_SECONDS)
                : episode.getDurationSeconds();
        String accessPolicy = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.ACCESS_POLICY)
                ? WorkingDraftMaps.getString(draft, WorkingDraftMaps.ACCESS_POLICY)
                : episode.getAccessPolicy().name();
        Integer requiredLevelSortOrder =
                hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER)
                        ? WorkingDraftMaps.getInteger(draft, WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER)
                        : episode.getRequiredLevelSortOrder();

        // Same artwork rule as RSS enclosures (episode → format → series) and the same
        // public-only URL policy as list thumbnails: private covers stay null, editors
        // keep resolving those per asset through the media preview endpoint.
        return new EpisodeView(
                episode.getId(),
                episode.getSeries().getId(),
                episode.getSeries().getSlug(),
                episodeNumber,
                slug,
                title,
                description,
                audioAssetId,
                coverAssetId,
                resolvePublicCoverImageUrl(episode),
                durationSeconds,
                accessPolicy,
                requiredLevelSortOrder,
                episode.getStatus().name(),
                episode.isEnclosureEnabled(),
                episode.getPublishedAt(),
                episode.getScheduledAt(),
                episode.getEmailNotifiedAt(),
                studioFormats(episode, draft, hasDraft),
                studioCategories(episode, draft, hasDraft),
                episode.getCreatedBy(),
                episode.getCreatedAt(),
                episode.getUpdatedAt(),
                hasDraft
        );
    }

    private static Long resolveStudioCoverAssetId(
            Episode episode, Map<String, Object> draft, boolean hasDraft) {
        if (!hasDraft) {
            return episode.getCoverAsset() != null ? episode.getCoverAsset().getId() : null;
        }
        if (WorkingDraftMaps.getBoolean(draft, WorkingDraftMaps.CLEAR_COVER_ASSET, false)) {
            return null;
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.COVER_ASSET_ID)) {
            return WorkingDraftMaps.getLong(draft, WorkingDraftMaps.COVER_ASSET_ID);
        }
        return episode.getCoverAsset() != null ? episode.getCoverAsset().getId() : null;
    }

    private List<FormatView> studioFormats(Episode episode, Map<String, Object> draft, boolean hasDraft) {
        if (hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.FORMAT_IDS)) {
            Long tenantId = episode.getTenant().getId();
            return WorkingDraftMaps.getLongList(draft, WorkingDraftMaps.FORMAT_IDS).stream()
                    .map(id -> formatRepository.findByIdAndTenantId(id, tenantId)
                            .orElseThrow(() -> new FormatNotFoundException(id)))
                    .sorted(FormatView.DISPLAY_ORDER)
                    .map(FormatView::of)
                    .toList();
        }
        return episode.getFormats().stream()
                .sorted(FormatView.DISPLAY_ORDER)
                .map(FormatView::of)
                .toList();
    }

    private List<CategoryView> studioCategories(
            Episode episode, Map<String, Object> draft, boolean hasDraft) {
        if (hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.CATEGORY_IDS)) {
            Long tenantId = episode.getTenant().getId();
            Set<Long> ids = new LinkedHashSet<>(
                    WorkingDraftMaps.getLongList(draft, WorkingDraftMaps.CATEGORY_IDS));
            return categoryService.resolveActiveCategories(tenantId, ids, id -> { })
                    .stream()
                    .sorted(CategoryView.DISPLAY_ORDER)
                    .map(CategoryView::of)
                    .toList();
        }
        return episode.getCategories().stream()
                .sorted(CategoryView.DISPLAY_ORDER)
                .map(CategoryView::of)
                .toList();
    }

    private String resolvePublicCoverImageUrl(Episode episode) {
        return episodeCoverResolver.resolveCoverAsset(episode)
                .flatMap(episodeMediaApi::publicCdnUrl)
                .map(URL::toString)
                .orElse(null);
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
