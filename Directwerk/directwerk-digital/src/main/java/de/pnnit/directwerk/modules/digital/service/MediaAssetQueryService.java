package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.api.EffectiveUploadLimits;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.entity.MediaFolder;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.MediaFolderNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.repository.MediaFolderRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MediaAssetQueryService implements MediaAssetQueryApi {

    private final MediaAssetRepository mediaAssetRepository;
    private final MediaFolderRepository mediaFolderRepository;
    private final TenantRepository tenantRepository;

    @Override
    public Optional<MediaAsset> findById(Long assetId) {
        if (assetId == null) {
            return Optional.empty();
        }
        Optional<MediaAsset> asset = mediaAssetRepository.findById(assetId);
        // Hibernate filters do not apply to EntityManager.find() — the path behind
        // repository findById — so enforce the Host-derived TenantContext explicitly.
        // Without this, any editor could read another tenant's asset metadata
        // (including s3Key, ownerUserId, episode linkage) by ID via
        // GET /api/v1/media/{id} or GET /api/v1/podcast/import/assets/{assetId}.
        // A mismatch returns empty so callers map to 404, never a cross-tenant leak.
        // Absent context (platform ops / workers scope explicitly via callWithTenant)
        // preserves existing behavior.
        Long contextTenantId = TenantContext.getTenantId();
        if (contextTenantId == null) {
            return asset;
        }
        return asset.filter(candidate ->
                candidate.getTenant() != null && contextTenantId.equals(candidate.getTenant().getId()));
    }

    @Override
    public List<MediaAssetReference> listAttachedReferences(Long assetId) {
        if (findById(assetId).isEmpty()) {
            throw new MediaAssetNotFoundException(assetId);
        }
        List<Object[]> rows = mediaAssetRepository.findAttachedReferences(assetId);
        List<MediaAssetReference> references = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            if (row == null || row.length < 3 || row[0] == null || row[1] == null) {
                continue;
            }
            references.add(new MediaAssetReference(
                    String.valueOf(row[0]),
                    ((Number) row[1]).longValue(),
                    row[2] == null ? "" : String.valueOf(row[2])
            ));
        }
        return references;
    }

    @Override
    public List<MediaAsset> list(AssetType assetType, AssetStatus status, int limit) {
        return list(assetType, status, limit, 0);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaAsset> list(AssetType assetType, AssetStatus status, int limit, int offset) {
        PageRequest page = pageRequest(limit, offset);
        return mediaAssetRepository.findFiltered(assetType, status, page);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaAsset> listInFolder(
            AssetType assetType,
            AssetStatus status,
            Long folderId,
            boolean recursive,
            boolean unassignedOnly,
            boolean unreferencedOnly,
            int limit,
            int offset) {
        PageRequest page = pageRequest(limit, offset);
        if (folderId != null && unassignedOnly) {
            throw new IllegalArgumentException("folderId and unassignedOnly are mutually exclusive");
        }
        if (unreferencedOnly) {
            return listUnreferenced(assetType, status, folderId, recursive, unassignedOnly, page);
        }
        if (unassignedOnly) {
            return mediaAssetRepository.findFilteredUnassigned(assetType, status, page);
        }
        if (folderId == null) {
            return mediaAssetRepository.findFiltered(assetType, status, page);
        }
        Long tenantId = TenantContext.requireTenantId();
        List<Long> folderIds = new java.util.ArrayList<>();
        folderIds.add(requireFolderInContext(tenantId, folderId).getId());
        if (recursive) {
            folderIds.addAll(collectDescendantIds(tenantId, folderId));
        }
        return mediaAssetRepository.findFilteredInFolders(assetType, status, folderIds, page);
    }

    private List<MediaAsset> listUnreferenced(
            AssetType assetType,
            AssetStatus status,
            Long folderId,
            boolean recursive,
            boolean unassignedOnly,
            PageRequest page) {
        Long tenantId = TenantContext.requireTenantId();
        String assetTypeName = assetType == null ? null : assetType.name();
        String statusName = status == null ? null : status.name();
        List<Long> ids;
        if (unassignedOnly) {
            ids = mediaAssetRepository.findFilteredUnassignedUnreferencedIds(
                    tenantId, assetTypeName, statusName, page);
        } else if (folderId == null) {
            ids = mediaAssetRepository.findFilteredUnreferencedIds(
                    tenantId, assetTypeName, statusName, page);
        } else {
            List<Long> folderIds = new ArrayList<>();
            folderIds.add(requireFolderInContext(tenantId, folderId).getId());
            if (recursive) {
                folderIds.addAll(collectDescendantIds(tenantId, folderId));
            }
            ids = mediaAssetRepository.findFilteredInFoldersUnreferencedIds(
                    tenantId, assetTypeName, statusName, folderIds, page);
        }
        return hydrateInOrder(ids);
    }

    private List<MediaAsset> hydrateInOrder(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, MediaAsset> byId = new LinkedHashMap<>();
        for (MediaAsset asset : mediaAssetRepository.findAllWithTenantByIdIn(ids)) {
            byId.put(asset.getId(), asset);
        }
        List<MediaAsset> ordered = new ArrayList<>(ids.size());
        for (Long id : ids) {
            MediaAsset asset = byId.get(id);
            if (asset != null) {
                ordered.add(asset);
            }
        }
        return ordered;
    }

    private static PageRequest pageRequest(int limit, int offset) {
        int pageSize = Math.min(Math.max(limit, 1), 100);
        int safeOffset = Math.max(offset, 0);
        return PageRequest.of(safeOffset / pageSize, pageSize);
    }

    private MediaFolder requireFolderInContext(Long tenantId, Long folderId) {
        return mediaFolderRepository.findByIdAndTenantId(folderId, tenantId)
                .orElseThrow(() -> new MediaFolderNotFoundException(folderId));
    }

    private List<Long> collectDescendantIds(Long tenantId, Long folderId) {
        Map<Long, List<Long>> childIdsByParent = new HashMap<>();
        for (MediaFolder candidate : mediaFolderRepository.findByTenantIdOrderByNameAscIdAsc(tenantId)) {
            if (candidate.getParent() != null && candidate.getParent().getId() != null) {
                childIdsByParent
                        .computeIfAbsent(candidate.getParent().getId(), key -> new ArrayList<>())
                        .add(candidate.getId());
            }
        }
        List<Long> descendantIds = new ArrayList<>();
        Deque<Long> queue = new ArrayDeque<>(childIdsByParent.getOrDefault(folderId, List.of()));
        while (!queue.isEmpty()) {
            Long current = queue.removeFirst();
            descendantIds.add(current);
            queue.addAll(childIdsByParent.getOrDefault(current, List.of()));
        }
        return descendantIds;
    }

    @Override
    public List<MediaAsset> listForTenant(Long tenantId, AssetType assetType, AssetStatus status, int limit) {
        tenantRepository.requireById(tenantId);
        return TenantContext.callWithTenant(tenantId, () -> list(assetType, status, limit));
    }

    @Override
    public EffectiveUploadLimits effectiveUploadLimits(Long tenantId) {
        var tenant = tenantRepository.requireById(tenantId);
        return new EffectiveUploadLimits(
                MediaUploadRules.effectiveMaxBytes(AssetType.AUDIO, tenant.getMaxAudioBytes()),
                MediaUploadRules.effectiveMaxBytes(AssetType.IMAGE, tenant.getMaxImageBytes()),
                MediaUploadRules.effectiveMaxBytes(AssetType.VIDEO, tenant.getMaxVideoBytes()),
                MediaUploadRules.effectiveMaxBytes(AssetType.DOCUMENT, tenant.getMaxDocumentBytes())
        );
    }

    @Override
    public MediaStorageSummary storageSummary(Long tenantId) {
        tenantRepository.requireById(tenantId);
        List<MediaStorageBucket> buckets = new ArrayList<>();
        long totalAssets = 0L;
        long totalBytes = 0L;
        for (MediaAssetRepository.StorageSummary row : mediaAssetRepository.summarizeStorage(tenantId)) {
            long count = row.getAssetCount();
            long bytes = row.getTotalBytes();
            buckets.add(new MediaStorageBucket(row.getAssetType(), row.getStatus(), count, bytes));
            totalAssets += count;
            totalBytes += bytes;
        }
        return new MediaStorageSummary(totalAssets, totalBytes, buckets);
    }

    @Override
    public Map<Long, Long> countActiveAssetsByFolder(Long tenantId) {
        tenantRepository.requireById(tenantId);
        Map<Long, Long> counts = new HashMap<>();
        for (MediaAssetRepository.FolderAssetCount row : mediaAssetRepository.countActiveByFolder(tenantId)) {
            if (row.getFolderId() != null && row.getAssetCount() != null) {
                counts.put(row.getFolderId(), row.getAssetCount());
            }
        }
        return counts;
    }

    @Override
    public long countActiveAssetsInFolder(Long tenantId, Long folderId) {
        tenantRepository.requireById(tenantId);
        if (folderId == null) {
            return 0L;
        }
        return mediaAssetRepository.countActiveByTenantIdAndFolderId(tenantId, folderId);
    }
}
