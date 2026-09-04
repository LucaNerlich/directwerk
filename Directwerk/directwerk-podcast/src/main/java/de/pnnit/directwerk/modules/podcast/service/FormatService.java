package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.FieldConstraints;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.job.RssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.podcast.exception.FormatNotFoundException;
import de.pnnit.directwerk.modules.podcast.repository.FormatRepository;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FormatService {

    private static final int MAX_NAME_LENGTH = 255;

    private final FormatRepository formatRepository;
    private final TenantRepository tenantRepository;
    private final PodcastCoverAssetResolver podcastCoverAssetResolver;
    private final RssFeedRefreshJobProducer rssFeedRefreshScheduler;

    @Transactional(readOnly = true)
    public List<Format> listFormats(Long tenantId, boolean activeOnly) {
        if (activeOnly) {
            return formatRepository.findByTenantIdAndActiveTrueOrderBySortOrderAscIdAsc(tenantId);
        }
        return formatRepository.findByTenantIdOrderBySortOrderAscIdAsc(tenantId);
    }

    @Transactional(readOnly = true)
    public Format requireFormat(Long tenantId, Long formatId) {
        return formatRepository.findByIdAndTenantId(formatId, tenantId)
                .orElseThrow(() -> new FormatNotFoundException(formatId));
    }

    @Transactional(readOnly = true)
    public boolean hasActiveFormats(Long tenantId) {
        return formatRepository.countByTenantIdAndActiveTrue(tenantId) > 0;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Format createFormat(
            Long tenantId,
            String rawSlug,
            String name,
            String description,
            Integer requiredLevelSortOrder,
            Integer sortOrder,
            Long coverAssetId
    ) {
        String slug = SlugNormalizer.normalize(rawSlug);
        if (formatRepository.existsByTenantIdAndSlug(tenantId, slug)) {
            throw new ConflictException(ConflictCodes.FORMAT_SLUG_EXISTS, "Format slug already exists: " + slug);
        }

        Format format = new Format();
        format.setTenant(tenantRepository.getReferenceById(tenantId));
        format.setSlug(slug);
        format.setName(normalizeName(name));
        format.setDescription(normalizeText(description));
        format.setRequiredLevelSortOrder(FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder"));
        format.setSortOrder(sortOrder != null ? FieldConstraints.requireNonNegative(sortOrder, "sortOrder") : 0);
        format.setActive(true);
        format.setCoverAsset(podcastCoverAssetResolver.resolveCoverAsset(tenantId, coverAssetId));
        return formatRepository.save(format);
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Format updateFormat(
            Long tenantId,
            Long formatId,
            String rawSlug,
            String name,
            String description,
            Integer requiredLevelSortOrder,
            Integer sortOrder,
            Boolean active,
            Long coverAssetId
    ) {
        Format format = requireFormat(tenantId, formatId);
        Integer previousRequiredLevel = format.getRequiredLevelSortOrder();
        boolean previousActive = format.isActive();
        MediaAsset previousCover = format.getCoverAsset();
        if (rawSlug != null) {
            String slug = SlugNormalizer.normalize(rawSlug);
            if (formatRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, formatId)) {
                throw new ConflictException(ConflictCodes.FORMAT_SLUG_EXISTS, "Format slug already exists: " + slug);
            }
            format.setSlug(slug);
        }
        if (name != null) {
            format.setName(normalizeName(name));
        }
        if (description != null) {
            format.setDescription(normalizeText(description));
        }
        if (requiredLevelSortOrder != null) {
            format.setRequiredLevelSortOrder(FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder"));
        }
        if (sortOrder != null) {
            format.setSortOrder(FieldConstraints.requireNonNegative(sortOrder, "sortOrder"));
        }
        if (active != null) {
            format.setActive(active);
        }
        if (coverAssetId != null) {
            format.setCoverAsset(podcastCoverAssetResolver.resolveCoverAsset(tenantId, coverAssetId));
        }
        Format saved = formatRepository.save(format);
        boolean levelChanged = !Objects.equals(previousRequiredLevel, saved.getRequiredLevelSortOrder());
        boolean activeChanged = previousActive != saved.isActive();
        boolean coverChanged = !Objects.equals(previousCover, saved.getCoverAsset());
        if (levelChanged || activeChanged || coverChanged) {
            rssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        }
        return saved;
    }

    @Transactional
    @RequiresModule(PodcastModule.KEY)
    public Format deactivateFormat(Long tenantId, Long formatId) {
        return updateFormat(tenantId, formatId, null, null, null, null, null, false, null);
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Format name is required");
        }
        String normalized = name.trim();
        if (normalized.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Format name must be at most 255 characters");
        }
        return normalized;
    }

    private static String normalizeText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
