package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.core.util.FieldConstraints;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.core.util.TitleNormalizer;
import de.pnnit.directwerk.modules.digital.BonusContentModule;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.DigitalPublication;
import de.pnnit.directwerk.modules.digital.entity.DigitalPublicationStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.DigitalPublicationNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.DigitalPublicationRepository;
import de.pnnit.directwerk.security.SecurityUtils;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class DigitalPublicationService {

    private final DigitalPublicationRepository digitalPublicationRepository;
    private final TenantRepository tenantRepository;
    private final MediaAssetQueryApi mediaAssetQueryApi;
    private final MembershipPermissionService permissionService;

    @Transactional(readOnly = true)
    public List<DigitalPublication> list(Long tenantId) {
        return digitalPublicationRepository.findByTenant_IdOrderByUpdatedAtDescIdDesc(tenantId);
    }

    @Transactional(readOnly = true)
    public List<DigitalPublication> listPublished(Long tenantId) {
        return digitalPublicationRepository.findByTenantIdAndStatus(tenantId, DigitalPublicationStatus.PUBLISHED);
    }

    @Transactional(readOnly = true)
    public DigitalPublication require(Long tenantId, Long publicationId) {
        return digitalPublicationRepository.findByIdAndTenant_Id(publicationId, tenantId)
                .orElseThrow(() -> new DigitalPublicationNotFoundException(publicationId));
    }

    @Transactional
    @RequiresModule(BonusContentModule.KEY)
    public DigitalPublication createDraft(
            Long tenantId,
            String rawSlug,
            String title,
            String description,
            Long assetId,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder
    ) {
        permissionService.requireMediaAssetAccess(ContentOperation.CREATE, null);
        String slug = SlugNormalizer.normalize(rawSlug);
        if (digitalPublicationRepository.existsByTenant_IdAndSlug(tenantId, slug)) {
            throw new ConflictException(
                    ConflictCodes.DIGITAL_PUBLICATION_SLUG_EXISTS,
                    "Digital publication slug already exists: " + slug
            );
        }

        DigitalPublication publication = new DigitalPublication();
        publication.setTenant(tenantRepository.getReferenceById(tenantId));
        publication.setCreatedBy(SecurityUtils.currentUserId());
        publication.setSlug(slug);
        publication.setTitle(TitleNormalizer.normalize(title, "Bonusdatei"));
        publication.setDescription(normalizeOptionalText(description));
        publication.setAsset(requireReadyDocument(tenantId, assetId));
        publication.setAccessPolicy(accessPolicy == null ? AccessPolicy.FREE : accessPolicy);
        publication.setRequiredLevelSortOrder(
                FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder")
        );
        publication.setStatus(DigitalPublicationStatus.DRAFT);
        return digitalPublicationRepository.save(publication);
    }

    @Transactional
    @RequiresModule(BonusContentModule.KEY)
    public DigitalPublication updateDraft(
            Long tenantId,
            Long publicationId,
            String rawSlug,
            String title,
            String description,
            Long assetId,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder
    ) {
        DigitalPublication publication = require(tenantId, publicationId);
        permissionService.requireMediaAssetAccess(ContentOperation.UPDATE, publication.getCreatedBy());
        if (publication.getStatus() == DigitalPublicationStatus.PUBLISHED) {
            throw new IllegalArgumentException("Published bonus files must be unpublished before editing");
        }
        if (rawSlug != null) {
            String slug = SlugNormalizer.normalize(rawSlug);
            if (digitalPublicationRepository.existsByTenant_IdAndSlugAndIdNot(tenantId, slug, publicationId)) {
                throw new ConflictException(
                        ConflictCodes.DIGITAL_PUBLICATION_SLUG_EXISTS,
                        "Digital publication slug already exists: " + slug
                );
            }
            publication.setSlug(slug);
        }
        if (title != null) {
            publication.setTitle(TitleNormalizer.normalize(title, "Bonusdatei"));
        }
        if (description != null) {
            publication.setDescription(normalizeOptionalText(description));
        }
        if (assetId != null) {
            publication.setAsset(requireReadyDocument(tenantId, assetId));
        }
        if (accessPolicy != null) {
            publication.setAccessPolicy(accessPolicy);
        }
        if (requiredLevelSortOrder != null) {
            publication.setRequiredLevelSortOrder(
                    FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder")
            );
        }
        return digitalPublicationRepository.save(publication);
    }

    @Transactional
    @RequiresModule(BonusContentModule.KEY)
    public DigitalPublication publish(Long tenantId, Long publicationId) {
        DigitalPublication publication = require(tenantId, publicationId);
        permissionService.requireMediaAssetAccess(ContentOperation.PUBLISH, publication.getCreatedBy());
        requireReadyDocument(tenantId, publication.getAsset().getId());
        if (publication.getAccessPolicy() == AccessPolicy.PAID
                && publication.getRequiredLevelSortOrder() == null) {
            publication.setRequiredLevelSortOrder(0);
        }
        publication.setStatus(DigitalPublicationStatus.PUBLISHED);
        publication.setPublishedAt(Instant.now());
        return digitalPublicationRepository.save(publication);
    }

    @Transactional
    @RequiresModule(BonusContentModule.KEY)
    public DigitalPublication unpublish(Long tenantId, Long publicationId) {
        DigitalPublication publication = require(tenantId, publicationId);
        permissionService.requireMediaAssetAccess(ContentOperation.UNPUBLISH, publication.getCreatedBy());
        publication.setStatus(DigitalPublicationStatus.DRAFT);
        publication.setPublishedAt(null);
        return digitalPublicationRepository.save(publication);
    }

    @Transactional
    @RequiresModule(BonusContentModule.KEY)
    public DigitalPublication archive(Long tenantId, Long publicationId) {
        DigitalPublication publication = require(tenantId, publicationId);
        permissionService.requireMediaAssetAccess(ContentOperation.ARCHIVE, publication.getCreatedBy());
        publication.setStatus(DigitalPublicationStatus.ARCHIVED);
        return digitalPublicationRepository.save(publication);
    }

    @Transactional
    @RequiresModule(BonusContentModule.KEY)
    public DigitalPublication unarchive(Long tenantId, Long publicationId) {
        DigitalPublication publication = require(tenantId, publicationId);
        permissionService.requireMediaAssetAccess(ContentOperation.UPDATE, publication.getCreatedBy());
        if (publication.getStatus() != DigitalPublicationStatus.ARCHIVED) {
            throw new IllegalArgumentException("Only archived bonus files can be restored");
        }
        publication.setStatus(DigitalPublicationStatus.DRAFT);
        publication.setPublishedAt(null);
        return digitalPublicationRepository.save(publication);
    }

    @Transactional
    @RequiresModule(BonusContentModule.KEY)
    public void delete(Long tenantId, Long publicationId) {
        DigitalPublication publication = require(tenantId, publicationId);
        permissionService.requireMediaAssetAccess(ContentOperation.DELETE, publication.getCreatedBy());
        if (publication.getStatus() == DigitalPublicationStatus.PUBLISHED) {
            throw new IllegalArgumentException("Unpublish or archive before deleting a bonus file");
        }
        digitalPublicationRepository.delete(publication);
    }

    private MediaAsset requireReadyDocument(Long tenantId, Long assetId) {
        if (assetId == null) {
            throw new IllegalArgumentException("assetId is required");
        }
        MediaAsset asset = mediaAssetQueryApi.findById(assetId)
                .orElseThrow(() -> new MediaAssetNotFoundException(assetId));
        if (asset.getTenant() == null || !tenantId.equals(asset.getTenant().getId())) {
            throw new MediaAssetNotFoundException(assetId);
        }
        if (asset.getAssetType() != AssetType.DOCUMENT) {
            throw new IllegalArgumentException("Bonus files require a DOCUMENT asset");
        }
        if (asset.getStatus() != AssetStatus.READY) {
            throw new IllegalArgumentException("Bonus files require a READY document asset");
        }
        return asset;
    }

    private static String normalizeOptionalText(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
