package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.core.util.FieldConstraints;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.core.util.TitleNormalizer;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
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
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
import de.pnnit.directwerk.security.SecurityUtils;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
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

    @Transactional(readOnly = true)
    public List<Episode> listEpisodes(Long tenantId) {
        return episodeRepository.findByTenantIdOrderByCreatedAtDescIdDesc(tenantId);
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
        Episode episode = requireDraftEpisode(tenantId, episodeId);
        permissionService.requireEpisodeAccess(ContentOperation.UPDATE, episode.getCreatedBy());
        if (episodeNumber != null) {
            episode.setEpisodeNumber(FieldConstraints.requirePositive(episodeNumber, "episodeNumber"));
        }
        if (rawSlug != null) {
            String slug = SlugNormalizer.normalize(rawSlug);
            if (episodeRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, episodeId)) {
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
            episode.setRequiredLevelSortOrder(FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder"));
        }
        episodeRepository.save(episode);
        return requireEpisode(tenantId, episodeId);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode replaceFormats(Long tenantId, Long episodeId, Set<Long> formatIds) {
        Episode episode = requireDraftEpisode(tenantId, episodeId);
        permissionService.requireEpisodeAccess(ContentOperation.UPDATE, episode.getCreatedBy());
        episode.getFormats().clear();
        episode.getFormats().addAll(resolveFormats(tenantId, formatIds));
        episodeRepository.save(episode);
        return requireEpisode(tenantId, episodeId);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode replaceCategories(Long tenantId, Long episodeId, Set<Long> categoryIds) {
        Episode episode = requireDraftEpisode(tenantId, episodeId);
        permissionService.requireEpisodeAccess(ContentOperation.UPDATE, episode.getCreatedBy());
        episode.getCategories().clear();
        episode.getCategories().addAll(categoryService.resolveActiveCategories(tenantId, categoryIds,
                id -> { throw new EpisodeValidationException("Category is inactive: " + id); }));
        episodeRepository.save(episode);
        return requireEpisode(tenantId, episodeId);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Episode attachAudio(Long tenantId, Long episodeId, Long audioAssetId) {
        Episode episode = requireDraftEpisode(tenantId, episodeId);
        permissionService.requireEpisodeAccess(ContentOperation.UPDATE, episode.getCreatedBy());
        MediaAsset audio = episodeMediaApi.requireReadyAudio(audioAssetId);
        episode.setAudioAsset(audio);
        episodeRepository.save(episode);
        episodeMediaApi.attachEpisode(audioAssetId, episodeId);
        return requireEpisode(tenantId, episodeId);
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
        episodeRepository.delete(episode);
        if (wasVisible) {
            rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        }
    }

    private Episode requireDraftEpisode(Long tenantId, Long episodeId) {
        Episode episode = requireEpisode(tenantId, episodeId);
        if (episode.getStatus() != EpisodeStatus.DRAFT) {
            throw new EpisodeValidationException("Only DRAFT episodes can be edited");
        }
        return episode;
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
