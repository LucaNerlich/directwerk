package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.content.BulkPublication;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.content.WorkingDraftMaps;
import de.pnnit.directwerk.modules.core.util.FieldConstraints;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.core.util.TitleNormalizer;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.podcast.job.RssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeValidationException;
import de.pnnit.directwerk.modules.podcast.exception.FormatNotFoundException;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.search.SearchIndex;
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
import de.pnnit.directwerk.security.SecurityUtils;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import de.pnnit.directwerk.modules.core.util.OffsetLimitPageRequest;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EpisodeService {

    private final EpisodeRepository episodeRepository;
    private final SeriesService seriesService;
    private final FormatRepository formatRepository;
    private final CategoryService categoryService;
    private final TenantRepository tenantRepository;
    private final EpisodeMediaApi episodeMediaApi;
    private final HtmlSanitizer htmlSanitizer;
    private final PodcastCoverAssetResolver podcastCoverAssetResolver;
    private final RssFeedRefreshJobProducer rssFeedRefreshScheduler;
    private final MembershipPermissionService permissionService;
    private final SearchIndex searchIndex;

    /**
     * Paged variant (#310): bounds the response for tenants with large episode counts, where the
     * unbounded listing serialised every row in one response.
     */
    @Transactional(readOnly = true)
    public List<Episode> listEpisodes(Long tenantId, int limit) {
        return listEpisodes(tenantId, limit, 0);
    }

    /** Offset variant so a tenant can reach episodes past the first page (#733). */
    @Transactional(readOnly = true)
    public List<Episode> listEpisodes(Long tenantId, int limit, int offset) {
        return episodeRepository.findByTenantIdOrderByCreatedAtDescIdDesc(
                tenantId, OffsetLimitPageRequest.of(limit, offset));
    }

    @Transactional(readOnly = true)
    public Episode requireEpisode(Long tenantId, Long episodeId) {
        return episodeRepository.findByIdAndTenantId(episodeId, tenantId)
                .orElseThrow(() -> new EpisodeNotFoundException(episodeId));
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode createDraft(
            Long tenantId,
            Long seriesId,
            Integer episodeNumber,
            String rawSlug,
            String title,
            String description,
            Long audioAssetId,
            Long coverAssetId,
            Integer durationSeconds,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Set<Long> formatIds,
            Set<Long> categoryIds
    ) {
        permissionService.requireEpisodeAccess(ContentOperation.CREATE, null);
        return createDraftInternal(
                tenantId,
                seriesId,
                episodeNumber,
                rawSlug,
                title,
                description,
                audioAssetId,
                coverAssetId,
                durationSeconds,
                accessPolicy,
                requiredLevelSortOrder,
                formatIds,
                categoryIds,
                null,
                null
        );
    }

    /**
     * Creates a draft episode associated with a validated imported-episode identity.
     *
     * @param importIdentity a lowercase 64-character hexadecimal SHA-256 digest identifying the imported episode
     * @return the created draft episode
     * @throws EpisodeValidationException if {@code importIdentity} is not a lowercase SHA-256 digest
     */
    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode createImportedDraft(
            Long tenantId,
            Long seriesId,
            Integer episodeNumber,
            String rawSlug,
            String title,
            String description,
            Long audioAssetId,
            Long coverAssetId,
            Integer durationSeconds,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Set<Long> formatIds,
            Set<Long> categoryIds,
            String importIdentity,
            Instant publishedAt
    ) {
        if (importIdentity == null || !importIdentity.matches("[a-f0-9]{64}")) {
            throw new EpisodeValidationException("importIdentity must be a lowercase SHA-256 digest");
        }
        permissionService.requireEpisodeAccess(ContentOperation.CREATE, null);
        return createDraftInternal(
                tenantId,
                seriesId,
                episodeNumber,
                rawSlug,
                title,
                description,
                audioAssetId,
                coverAssetId,
                durationSeconds,
                accessPolicy,
                requiredLevelSortOrder,
                formatIds,
                categoryIds,
                importIdentity,
                publishedAt
        );
    }

    /**
     * Creates and persists a tenant-scoped draft episode with its metadata and relationships.
     *
     * @param tenantId the tenant that owns the episode
     * @param seriesId the series to which the episode belongs
     * @param rawSlug the requested episode slug before normalization
     * @param audioAssetId the optional ready audio asset to attach
     * @param coverAssetId the optional cover asset
     * @param importIdentity the optional import identity associated with the episode
     * @return the persisted draft episode
     */
    private Episode createDraftInternal(
            Long tenantId,
            Long seriesId,
            Integer episodeNumber,
            String rawSlug,
            String title,
            String description,
            Long audioAssetId,
            Long coverAssetId,
            Integer durationSeconds,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Set<Long> formatIds,
            Set<Long> categoryIds,
            String importIdentity,
            Instant publishedAt
    ) {
        PodcastSeries series = seriesService.requireSeries(tenantId, seriesId);
        String slug = SlugNormalizer.normalize(rawSlug);
        if (episodeRepository.existsByTenantIdAndSlug(tenantId, slug)) {
            throw new ConflictException(ConflictCodes.EPISODE_SLUG_EXISTS, "Episode slug already exists: " + slug);
        }

        Episode episode = new Episode();
        episode.setTenant(tenantRepository.getReferenceById(tenantId));
        episode.setSeries(series);
        episode.setCreatedBy(SecurityUtils.currentUserId());
        episode.setEpisodeNumber(FieldConstraints.requirePositive(episodeNumber, "episodeNumber"));
        episode.setSlug(slug);
        episode.setImportIdentity(importIdentity);
        episode.setTitle(TitleNormalizer.normalize(title, "Episode"));
        episode.setDescription(htmlSanitizer.sanitize(description));
        episode.setCoverAsset(podcastCoverAssetResolver.resolveCoverAsset(tenantId, coverAssetId));
        episode.setDurationSeconds(FieldConstraints.requirePositive(durationSeconds, "durationSeconds"));
        episode.setAccessPolicy(accessPolicy != null ? accessPolicy : AccessPolicy.FREE);
        episode.setRequiredLevelSortOrder(FieldConstraints.requireNonNegative(
                requiredLevelSortOrder != null ? requiredLevelSortOrder : series.getDefaultRequiredLevelSortOrder(),
                "requiredLevelSortOrder"
        ));
        episode.setStatus(EpisodeStatus.DRAFT);
        if (publishedAt != null) {
            episode.setPublishedAt(publishedAt);
        }
        episode.getFormats().addAll(resolveFormats(tenantId, formatIds));
        episode.getCategories().addAll(categoryService.resolveActiveCategories(tenantId, categoryIds,
                id -> { throw new EpisodeValidationException("Category is inactive: " + id); }));
        Episode saved = episodeRepository.save(episode);
        if (audioAssetId != null) {
            attachAudio(tenantId, saved.getId(), audioAssetId);
        }
        return requireEpisode(tenantId, saved.getId());
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode updateDraft(
            Long tenantId,
            Long episodeId,
            Integer episodeNumber,
            String rawSlug,
            String title,
            String description,
            Long coverAssetId,
            Integer durationSeconds,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Boolean clearCoverAsset
    ) {
        Episode episode = requireEditableEpisode(tenantId, episodeId);
        permissionService.requireEpisodeAccess(ContentOperation.UPDATE, episode.getCreatedBy());
        if (episode.getStatus() == EpisodeStatus.PUBLISHED) {
            return patchWorkingDraft(
                    tenantId,
                    episode,
                    episodeNumber,
                    rawSlug,
                    title,
                    description,
                    coverAssetId,
                    durationSeconds,
                    accessPolicy,
                    requiredLevelSortOrder,
                    clearCoverAsset,
                    null,
                    null,
                    null);
        }
        applyLiveFieldUpdates(
                tenantId,
                episode,
                episodeNumber,
                rawSlug,
                title,
                description,
                coverAssetId,
                durationSeconds,
                accessPolicy,
                requiredLevelSortOrder,
                clearCoverAsset);
        episodeRepository.save(episode);
        return requireEpisode(tenantId, episodeId);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode replaceFormats(Long tenantId, Long episodeId, Set<Long> formatIds) {
        Episode episode = requireEditableEpisode(tenantId, episodeId);
        permissionService.requireEpisodeAccess(ContentOperation.UPDATE, episode.getCreatedBy());
        Set<Format> resolved = resolveFormats(tenantId, formatIds);
        if (episode.getStatus() == EpisodeStatus.PUBLISHED) {
            List<Long> ids = resolved.stream().map(Format::getId).sorted().toList();
            return patchWorkingDraft(
                    tenantId, episode, null, null, null, null, null, null, null, null, null, ids, null, null);
        }
        episode.getFormats().clear();
        episode.getFormats().addAll(resolved);
        episodeRepository.save(episode);
        return requireEpisode(tenantId, episodeId);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode replaceCategories(Long tenantId, Long episodeId, Set<Long> categoryIds) {
        Episode episode = requireEditableEpisode(tenantId, episodeId);
        permissionService.requireEpisodeAccess(ContentOperation.UPDATE, episode.getCreatedBy());
        Set<Category> resolved = categoryService.resolveActiveCategories(tenantId, categoryIds,
                id -> { throw new EpisodeValidationException("Category is inactive: " + id); });
        Episode updated;
        if (episode.getStatus() == EpisodeStatus.PUBLISHED) {
            List<Long> ids = resolved.stream().map(Category::getId).sorted().toList();
            updated = patchWorkingDraft(
                    tenantId, episode, null, null, null, null, null, null, null, null, null, null, ids, null);
        } else {
            episode.getCategories().clear();
            episode.getCategories().addAll(resolved);
            episodeRepository.save(episode);
            updated = requireEpisode(tenantId, episodeId);
        }
        EpisodeSearchIndex.mirror(searchIndex, updated);
        return updated;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode attachAudio(Long tenantId, Long episodeId, Long audioAssetId) {
        Episode episode = requireEditableEpisode(tenantId, episodeId);
        permissionService.requireEpisodeAccess(ContentOperation.UPDATE, episode.getCreatedBy());
        MediaAsset audio = episodeMediaApi.requireReadyAudio(audioAssetId);
        if (episode.getStatus() == EpisodeStatus.PUBLISHED) {
            return patchWorkingDraft(
                    tenantId,
                    episode,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    audio.getId());
        }
        episode.setAudioAsset(audio);
        episodeRepository.save(episode);
        episodeMediaApi.attachEpisode(audioAssetId, episodeId);
        return requireEpisode(tenantId, episodeId);
    }

    /**
     * Applies a working-draft overlay onto live columns and join tables (over-publish / unpublish).
     */
    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public void applyWorkingDraft(Long tenantId, Episode episode) {
        Map<String, Object> draft = episode.getWorkingDraft();
        if (!WorkingDraftMaps.isPresent(draft)) {
            return;
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.EPISODE_NUMBER)) {
            episode.setEpisodeNumber(FieldConstraints.requirePositive(
                    WorkingDraftMaps.getInteger(draft, WorkingDraftMaps.EPISODE_NUMBER), "episodeNumber"));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.SLUG)) {
            String slug = SlugNormalizer.normalize(WorkingDraftMaps.getString(draft, WorkingDraftMaps.SLUG));
            if (episodeRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, episode.getId())) {
                throw new ConflictException(ConflictCodes.EPISODE_SLUG_EXISTS, "Episode slug already exists: " + slug);
            }
            episode.setSlug(slug);
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.TITLE)) {
            episode.setTitle(TitleNormalizer.normalize(
                    WorkingDraftMaps.getString(draft, WorkingDraftMaps.TITLE), "Episode"));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.DESCRIPTION)) {
            episode.setDescription(htmlSanitizer.sanitize(
                    WorkingDraftMaps.getString(draft, WorkingDraftMaps.DESCRIPTION)));
        }
        if (WorkingDraftMaps.getBoolean(draft, WorkingDraftMaps.CLEAR_COVER_ASSET, false)) {
            episode.setCoverAsset(null);
        } else if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.COVER_ASSET_ID)) {
            episode.setCoverAsset(podcastCoverAssetResolver.resolveCoverAsset(
                    tenantId, WorkingDraftMaps.getLong(draft, WorkingDraftMaps.COVER_ASSET_ID)));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.DURATION_SECONDS)) {
            episode.setDurationSeconds(FieldConstraints.requirePositive(
                    WorkingDraftMaps.getInteger(draft, WorkingDraftMaps.DURATION_SECONDS), "durationSeconds"));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.ACCESS_POLICY)) {
            episode.setAccessPolicy(AccessPolicy.valueOf(
                    WorkingDraftMaps.getString(draft, WorkingDraftMaps.ACCESS_POLICY)));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER)) {
            episode.setRequiredLevelSortOrder(FieldConstraints.requireNonNegative(
                    WorkingDraftMaps.getInteger(draft, WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER),
                    "requiredLevelSortOrder"));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.FORMAT_IDS)) {
            Set<Long> formatIds = new LinkedHashSet<>(
                    WorkingDraftMaps.getLongList(draft, WorkingDraftMaps.FORMAT_IDS));
            episode.getFormats().clear();
            episode.getFormats().addAll(resolveFormats(tenantId, formatIds));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.CATEGORY_IDS)) {
            Set<Long> categoryIds = new LinkedHashSet<>(
                    WorkingDraftMaps.getLongList(draft, WorkingDraftMaps.CATEGORY_IDS));
            episode.getCategories().clear();
            episode.getCategories().addAll(categoryService.resolveActiveCategories(tenantId, categoryIds,
                    id -> { throw new EpisodeValidationException("Category is inactive: " + id); }));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.AUDIO_ASSET_ID)) {
            Long audioAssetId = WorkingDraftMaps.getLong(draft, WorkingDraftMaps.AUDIO_ASSET_ID);
            MediaAsset previous = episode.getAudioAsset();
            MediaAsset audio = episodeMediaApi.requireReadyAudio(audioAssetId);
            episode.setAudioAsset(audio);
            episodeMediaApi.attachEpisode(audioAssetId, episode.getId());
            if (previous != null
                    && previous.getId() != null
                    && !previous.getId().equals(audioAssetId)
                    && previous.getVisibility() == AssetVisibility.PUBLIC) {
                episodeMediaApi.demoteToPrivate(previous.getId());
            }
        }
        episode.setWorkingDraft(null);
    }

    /** Toggle stable enclosure proxy URLs for published or draft episodes. */
    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode setEnclosureEnabled(Long tenantId, Long episodeId, boolean enclosureEnabled) {
        Episode episode = requireEpisode(tenantId, episodeId);
        permissionService.requireEpisodeAccess(ContentOperation.UPDATE, episode.getCreatedBy());
        episode.setEnclosureEnabled(enclosureEnabled);
        Episode saved = episodeRepository.save(episode);
        if (episode.getStatus() == EpisodeStatus.PUBLISHED) {
            rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        }
        return saved;
    }

    /**
     * Deletes an episode in any status. The tenant-scoped lookup returns 404 for foreign-tenant
     * ids, and the explicit tenant comparison below keeps the delete fail-closed even if the
     * query scoping is ever bypassed. Media assets are detached, never deleted: the
     * {@code trg_episodes_null_media_asset_refs} trigger nulls {@code media_assets.episode_id}
     * and the episode row owns the audio/cover references, so S3 objects survive. Join rows
     * (formats, categories) cascade. Custom/subscriber feeds reference categories and formats,
     * never episode ids, so no feed rules need cleanup; the refresh below rebuilds the public
     * snapshots when the deleted episode was visible.
     */
    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public void deleteEpisode(Long tenantId, Long episodeId) {
        Episode episode = requireEpisode(tenantId, episodeId);
        if (episode.getTenant() == null || !tenantId.equals(episode.getTenant().getId())) {
            throw new EpisodeNotFoundException(episodeId);
        }
        permissionService.requireEpisodeAccess(ContentOperation.DELETE, episode.getCreatedBy());
        boolean wasVisible = episode.getStatus() == EpisodeStatus.PUBLISHED
                || episode.getStatus() == EpisodeStatus.SCHEDULED;
        EpisodeSearchIndex.remove(searchIndex, tenantId, episodeId);
        episodeRepository.delete(episode);
        if (wasVisible) {
            rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        }
    }

    /**
     * Deletes every id in a single transaction with at most one RSS refresh.
     * Atomic: the first failure (unknown id, cross-tenant id, denied access)
     * rolls back all deletes. Returns the deleted ids in request order
     * (duplicates removed).
     */
    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public List<Long> bulkDelete(Long tenantId, List<Long> episodeIds) {
        List<Long> deleted = new ArrayList<>();
        boolean anyVisible = false;
        for (Long episodeId : BulkPublication.distinctIds(episodeIds)) {
            Episode episode = requireEpisode(tenantId, episodeId);
            if (episode.getTenant() == null || !tenantId.equals(episode.getTenant().getId())) {
                throw new EpisodeNotFoundException(episodeId);
            }
            permissionService.requireEpisodeAccess(ContentOperation.DELETE, episode.getCreatedBy());
            anyVisible = anyVisible
                    || episode.getStatus() == EpisodeStatus.PUBLISHED
                    || episode.getStatus() == EpisodeStatus.SCHEDULED;
            EpisodeSearchIndex.remove(searchIndex, tenantId, episodeId);
            episodeRepository.delete(episode);
            deleted.add(episodeId);
        }
        if (anyVisible) {
            rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        }
        return deleted;
    }

    private Episode requireEditableEpisode(Long tenantId, Long episodeId) {
        Episode episode = requireEpisode(tenantId, episodeId);
        EpisodeStatus status = episode.getStatus();
        if (status != EpisodeStatus.DRAFT && status != EpisodeStatus.PUBLISHED) {
            throw new EpisodeValidationException(
                    "Only DRAFT or PUBLISHED episodes can be edited");
        }
        return episode;
    }

    private Episode patchWorkingDraft(
            Long tenantId,
            Episode episode,
            Integer episodeNumber,
            String rawSlug,
            String title,
            String description,
            Long coverAssetId,
            Integer durationSeconds,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Boolean clearCoverAsset,
            List<Long> formatIds,
            List<Long> categoryIds,
            Long audioAssetId
    ) {
        Map<String, Object> draft = WorkingDraftMaps.isPresent(episode.getWorkingDraft())
                ? WorkingDraftMaps.mutableCopy(episode.getWorkingDraft())
                : seedWorkingDraft(episode);
        if (episodeNumber != null) {
            WorkingDraftMaps.putInteger(
                    draft,
                    WorkingDraftMaps.EPISODE_NUMBER,
                    FieldConstraints.requirePositive(episodeNumber, "episodeNumber"));
        }
        if (rawSlug != null) {
            String slug = SlugNormalizer.normalize(rawSlug);
            if (episodeRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, episode.getId())) {
                throw new ConflictException(ConflictCodes.EPISODE_SLUG_EXISTS, "Episode slug already exists: " + slug);
            }
            WorkingDraftMaps.putString(draft, WorkingDraftMaps.SLUG, slug);
        }
        if (title != null) {
            WorkingDraftMaps.putString(
                    draft, WorkingDraftMaps.TITLE, TitleNormalizer.normalize(title, "Episode"));
        }
        if (description != null) {
            WorkingDraftMaps.putString(
                    draft, WorkingDraftMaps.DESCRIPTION, htmlSanitizer.sanitize(description));
        }
        if (Boolean.TRUE.equals(clearCoverAsset)) {
            WorkingDraftMaps.putBoolean(draft, WorkingDraftMaps.CLEAR_COVER_ASSET, true);
            WorkingDraftMaps.putNullableLong(draft, WorkingDraftMaps.COVER_ASSET_ID, null);
        } else if (coverAssetId != null) {
            podcastCoverAssetResolver.resolveCoverAsset(tenantId, coverAssetId);
            WorkingDraftMaps.putBoolean(draft, WorkingDraftMaps.CLEAR_COVER_ASSET, false);
            WorkingDraftMaps.putNullableLong(draft, WorkingDraftMaps.COVER_ASSET_ID, coverAssetId);
        }
        if (durationSeconds != null) {
            WorkingDraftMaps.putInteger(
                    draft,
                    WorkingDraftMaps.DURATION_SECONDS,
                    FieldConstraints.requirePositive(durationSeconds, "durationSeconds"));
        }
        if (accessPolicy != null) {
            WorkingDraftMaps.putString(draft, WorkingDraftMaps.ACCESS_POLICY, accessPolicy.name());
        }
        if (requiredLevelSortOrder != null) {
            WorkingDraftMaps.putInteger(
                    draft,
                    WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER,
                    FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder"));
        }
        if (formatIds != null) {
            WorkingDraftMaps.putLongList(draft, WorkingDraftMaps.FORMAT_IDS, formatIds);
        }
        if (categoryIds != null) {
            WorkingDraftMaps.putLongList(draft, WorkingDraftMaps.CATEGORY_IDS, categoryIds);
        }
        if (audioAssetId != null) {
            WorkingDraftMaps.putNullableLong(draft, WorkingDraftMaps.AUDIO_ASSET_ID, audioAssetId);
        }
        episode.setWorkingDraft(draft);
        episodeRepository.save(episode);
        return requireEpisode(tenantId, episode.getId());
    }

    private Map<String, Object> seedWorkingDraft(Episode episode) {
        Map<String, Object> draft = WorkingDraftMaps.mutableCopy(null);
        WorkingDraftMaps.putInteger(draft, WorkingDraftMaps.EPISODE_NUMBER, episode.getEpisodeNumber());
        WorkingDraftMaps.putString(draft, WorkingDraftMaps.SLUG, episode.getSlug());
        WorkingDraftMaps.putString(draft, WorkingDraftMaps.TITLE, episode.getTitle());
        WorkingDraftMaps.putString(draft, WorkingDraftMaps.DESCRIPTION, episode.getDescription());
        WorkingDraftMaps.putNullableLong(
                draft,
                WorkingDraftMaps.COVER_ASSET_ID,
                episode.getCoverAsset() != null ? episode.getCoverAsset().getId() : null);
        WorkingDraftMaps.putBoolean(draft, WorkingDraftMaps.CLEAR_COVER_ASSET, false);
        WorkingDraftMaps.putNullableLong(
                draft,
                WorkingDraftMaps.AUDIO_ASSET_ID,
                episode.getAudioAsset() != null ? episode.getAudioAsset().getId() : null);
        WorkingDraftMaps.putInteger(draft, WorkingDraftMaps.DURATION_SECONDS, episode.getDurationSeconds());
        WorkingDraftMaps.putString(draft, WorkingDraftMaps.ACCESS_POLICY, episode.getAccessPolicy().name());
        WorkingDraftMaps.putInteger(
                draft, WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER, episode.getRequiredLevelSortOrder());
        WorkingDraftMaps.putLongList(
                draft,
                WorkingDraftMaps.FORMAT_IDS,
                episode.getFormats().stream().map(Format::getId).sorted().collect(Collectors.toList()));
        WorkingDraftMaps.putLongList(
                draft,
                WorkingDraftMaps.CATEGORY_IDS,
                episode.getCategories().stream().map(Category::getId).sorted().collect(Collectors.toList()));
        return draft;
    }

    private void applyLiveFieldUpdates(
            Long tenantId,
            Episode episode,
            Integer episodeNumber,
            String rawSlug,
            String title,
            String description,
            Long coverAssetId,
            Integer durationSeconds,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Boolean clearCoverAsset
    ) {
        if (episodeNumber != null) {
            episode.setEpisodeNumber(FieldConstraints.requirePositive(episodeNumber, "episodeNumber"));
        }
        if (rawSlug != null) {
            String slug = SlugNormalizer.normalize(rawSlug);
            if (episodeRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, episode.getId())) {
                throw new ConflictException(ConflictCodes.EPISODE_SLUG_EXISTS, "Episode slug already exists: " + slug);
            }
            episode.setSlug(slug);
        }
        if (title != null) {
            episode.setTitle(TitleNormalizer.normalize(title, "Episode"));
        }
        if (description != null) {
            episode.setDescription(htmlSanitizer.sanitize(description));
        }
        if (Boolean.TRUE.equals(clearCoverAsset)) {
            episode.setCoverAsset(null);
        } else if (coverAssetId != null) {
            episode.setCoverAsset(podcastCoverAssetResolver.resolveCoverAsset(tenantId, coverAssetId));
        }
        if (durationSeconds != null) {
            episode.setDurationSeconds(FieldConstraints.requirePositive(durationSeconds, "durationSeconds"));
        }
        if (accessPolicy != null) {
            episode.setAccessPolicy(accessPolicy);
        }
        if (requiredLevelSortOrder != null) {
            episode.setRequiredLevelSortOrder(
                    FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder"));
        }
    }

    private Set<Format> resolveFormats(Long tenantId, Set<Long> formatIds) {
        if (formatIds == null || formatIds.isEmpty()) {
            return Set.of();
        }
        Set<Format> formats = new LinkedHashSet<>();
        for (Long formatId : formatIds) {
            Format format = formatRepository.findByIdAndTenantId(formatId, tenantId)
                    .orElseThrow(() -> new FormatNotFoundException(formatId));
            if (!format.isActive()) {
                throw new EpisodeValidationException("Format is inactive: " + formatId);
            }
            formats.add(format);
        }
        return formats;
    }
}
