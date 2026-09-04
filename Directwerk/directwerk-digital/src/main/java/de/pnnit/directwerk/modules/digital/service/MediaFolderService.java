package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.api.FolderDeleteMode;
import de.pnnit.directwerk.modules.digital.api.MediaAssetLifecycleApi;
import de.pnnit.directwerk.modules.digital.api.MediaFolderApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.entity.MediaFolder;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.MediaFolderNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.repository.MediaFolderRepository;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import jakarta.persistence.EntityManager;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MediaFolderService implements MediaFolderApi {

    static final int MAX_NAME_LENGTH = 255;

    /** Maximum nesting depth. Root-level folders are depth 1. */
    static final int MAX_FOLDER_DEPTH = 8;

    private static final int MEDIA_FOLDER_LOCK_NAMESPACE = 0x4D464C44; // "MFLD"

    private final MediaFolderRepository mediaFolderRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final MediaAssetLifecycleApi mediaAssetLifecycleApi;
    private final TenantRepository tenantRepository;
    private final EntityManager entityManager;

    @Override
    @Transactional(readOnly = true)
    public List<MediaFolder> list(Long tenantId) {
        return mediaFolderRepository.findByTenantIdOrderByNameAscIdAsc(tenantId);
    }

    @Override
    @Transactional(readOnly = true)
    public MediaFolder requireFolder(Long tenantId, Long folderId) {
        if (folderId == null) {
            throw new MediaFolderNotFoundException(null);
        }
        return mediaFolderRepository.findByIdAndTenantId(folderId, tenantId)
                .orElseThrow(() -> new MediaFolderNotFoundException(folderId));
    }

    @Override
    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public MediaFolder createFolder(Long tenantId, String name, Long parentId) {
        String normalized = normalizeName(name);
        acquireTenantFolderLock(tenantId);
        MediaFolder parent = resolveParent(tenantId, parentId);
        assertDepthAllows(parent, 1);
        assertNameAvailable(tenantId, parent, normalized, null);

        MediaFolder folder = new MediaFolder();
        folder.setTenant(tenantRepository.getReferenceById(tenantId));
        folder.setName(normalized);
        folder.setParent(parent);
        return mediaFolderRepository.save(folder);
    }

    @Override
    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public MediaFolder renameFolder(Long tenantId, Long folderId, String name) {
        MediaFolder folder = requireFolder(tenantId, folderId);
        String normalized = normalizeName(name);
        assertNameAvailable(tenantId, folder.getParent(), normalized, folderId);
        folder.setName(normalized);
        return mediaFolderRepository.save(folder);
    }

    @Override
    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public MediaFolder moveFolder(Long tenantId, Long folderId, Long newParentId) {
        MediaFolder folder = requireFolder(tenantId, folderId);
        if (newParentId != null && newParentId.equals(folderId)) {
            throw new IllegalArgumentException("Folder cannot be its own parent");
        }
        acquireTenantFolderLock(tenantId);
        MediaFolder newParent = resolveParent(tenantId, newParentId);
        assertNoCycle(newParent, folderId);
        // The moved subtree keeps its shape: the deepest leaf ends up at
        // newParentDepth + subtreeHeight, which must fit the depth cap.
        int newParentDepth = depthOf(newParent);
        int subtreeHeight = subtreeHeight(tenantId, folder);
        if (newParentDepth + subtreeHeight > MAX_FOLDER_DEPTH) {
            throw new IllegalArgumentException(
                    "Moving this folder would exceed the maximum folder depth of " + MAX_FOLDER_DEPTH);
        }
        assertNameAvailable(tenantId, newParent, folder.getName(), folderId);
        folder.setParent(newParent);
        return mediaFolderRepository.save(folder);
    }

    @Override
    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public MediaFolder deleteFolder(
            Long tenantId, Long folderId, FolderDeleteMode mode, DirectwerkUserPrincipal principal) {
        MediaFolder folder = requireFolder(tenantId, folderId);
        acquireTenantFolderLock(tenantId);
        // Re-read inside the lock so the tree walk below sees a stable snapshot.
        folder = requireFolder(tenantId, folderId);
        MediaFolder parent = folder.getParent();
        if (mode == FolderDeleteMode.DELETE_CONTENTS) {
            deleteContents(tenantId, folder, principal);
        } else {
            moveContentsUp(tenantId, folder, parent);
        }
        mediaFolderRepository.delete(folder);
        return folder;
    }

    @Override
    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public MediaAsset moveAsset(Long tenantId, Long assetId, Long folderId) {
        acquireTenantFolderLock(tenantId);
        MediaAsset asset = mediaAssetRepository.findById(assetId)
                .filter(candidate -> candidate.getTenant() != null
                        && tenantId.equals(candidate.getTenant().getId()))
                .orElseThrow(() -> new MediaAssetNotFoundException(assetId));
        if (asset.getStatus() == AssetStatus.ARCHIVED
                || asset.getStatus() == AssetStatus.PENDING_DELETE) {
            throw new MediaAssetNotFoundException(assetId);
        }
        validateAndAssignFolder(tenantId, asset, folderId);
        return mediaAssetRepository.save(asset);
    }

    @Override
    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public void assignAssetToFolder(Long tenantId, MediaAsset asset, Long folderId) {
        acquireTenantFolderLock(tenantId);
        validateAndAssignFolder(tenantId, asset, folderId);
    }

    /**
     * Non-destructive delete: assets and direct subfolders move up to the deleted
     * folder's parent (or the library root when it was root-level).
     */
    private void moveContentsUp(Long tenantId, MediaFolder folder, MediaFolder parent) {
        List<MediaFolder> children = mediaFolderRepository.findByTenantIdAndParent(tenantId, folder);
        List<MediaFolder> destinationSiblings = parent == null
                ? mediaFolderRepository.findByTenantIdAndParentIdIsNull(tenantId)
                : mediaFolderRepository.findByTenantIdAndParent(tenantId, parent);
        for (MediaFolder child : children) {
            boolean collision = destinationSiblings.stream()
                    .anyMatch(sibling -> !sibling.getId().equals(folder.getId())
                            && !sibling.getId().equals(child.getId())
                            && sibling.getName().equals(child.getName()));
            if (collision) {
                throw new ConflictException(
                        ConflictCodes.MEDIA_FOLDER_NAME_EXISTS,
                        "A folder named '" + child.getName() + "' already exists in this location");
            }
        }
        for (MediaFolder child : children) {
            child.setParent(parent);
            mediaFolderRepository.save(child);
        }
        for (MediaAsset asset : mediaAssetRepository.findByTenantIdAndFolderId(tenantId, folder.getId())) {
            asset.setFolderId(parent != null ? parent.getId() : null);
            mediaAssetRepository.save(asset);
        }
    }

    /**
     * Destructive delete: every asset in the folder and all descendant folders goes
     * through the asset lifecycle (S3 purge jobs included), then folders are removed
     * deepest-first so the self-FK is never violated.
     */
    private void deleteContents(
            Long tenantId, MediaFolder folder, DirectwerkUserPrincipal principal) {
        List<MediaFolder> subtree = collectSubtree(tenantId, folder);
        for (MediaFolder descendant : subtree) {
            for (MediaAsset asset : mediaAssetRepository.findByTenantIdAndFolderId(tenantId, descendant.getId())) {
                mediaAssetLifecycleApi.delete(
                        new MediaAssetLifecycleApi.DeleteCommand(asset.getId(), principal, false));
            }
        }
        for (MediaAsset asset : mediaAssetRepository.findByTenantIdAndFolderId(tenantId, folder.getId())) {
            mediaAssetLifecycleApi.delete(
                    new MediaAssetLifecycleApi.DeleteCommand(asset.getId(), principal, false));
        }
        // Deepest folders first.
        subtree.sort((left, right) -> Integer.compare(depthOf(right), depthOf(left)));
        for (MediaFolder descendant : subtree) {
            mediaFolderRepository.delete(descendant);
        }
    }

    /** Every descendant of the folder (not the folder itself), in no particular order. */
    private List<MediaFolder> collectSubtree(Long tenantId, MediaFolder folder) {
        Map<Long, List<MediaFolder>> childrenByParent = new HashMap<>();
        for (MediaFolder candidate : mediaFolderRepository.findByTenantIdOrderByNameAscIdAsc(tenantId)) {
            if (candidate.getParent() != null && candidate.getParent().getId() != null) {
                childrenByParent
                        .computeIfAbsent(candidate.getParent().getId(), key -> new ArrayList<>())
                        .add(candidate);
            }
        }
        List<MediaFolder> subtree = new ArrayList<>();
        Deque<MediaFolder> queue = new ArrayDeque<>();
        queue.add(folder);
        while (!queue.isEmpty()) {
            MediaFolder current = queue.removeFirst();
            for (MediaFolder child : childrenByParent.getOrDefault(current.getId(), List.of())) {
                subtree.add(child);
                queue.add(child);
            }
        }
        return subtree;
    }

    /** Height of the subtree: 1 for a childless folder, more with descendants. */
    private int subtreeHeight(Long tenantId, MediaFolder folder) {
        Map<Long, List<Long>> childIdsByParent = new HashMap<>();
        for (MediaFolder candidate : mediaFolderRepository.findByTenantIdOrderByNameAscIdAsc(tenantId)) {
            if (candidate.getParent() != null && candidate.getParent().getId() != null) {
                childIdsByParent
                        .computeIfAbsent(candidate.getParent().getId(), key -> new ArrayList<>())
                        .add(candidate.getId());
            }
        }
        int height = 1;
        Deque<HeightNode> queue = new ArrayDeque<>();
        queue.add(new HeightNode(folder.getId(), 1));
        while (!queue.isEmpty()) {
            HeightNode current = queue.removeFirst();
            height = Math.max(height, current.height());
            for (Long childId : childIdsByParent.getOrDefault(current.id(), List.of())) {
                queue.add(new HeightNode(childId, current.height() + 1));
            }
        }
        return height;
    }

    private record HeightNode(Long id, int height) {
    }

    private MediaFolder resolveParent(Long tenantId, Long parentId) {
        if (parentId == null) {
            return null;
        }
        return requireFolder(tenantId, parentId);
    }

    private void validateAndAssignFolder(Long tenantId, MediaAsset asset, Long folderId) {
        if (folderId != null) {
            requireFolder(tenantId, folderId);
        }
        asset.setFolderId(folderId);
    }

    /** Depth of a folder: root-level folders are 1. A {@code null} parent (root) is 0. */
    private static int depthOf(MediaFolder folder) {
        int depth = 0;
        MediaFolder current = folder;
        while (current != null) {
            depth += 1;
            current = current.getParent();
        }
        return depth;
    }

    private static void assertDepthAllows(MediaFolder parent, int additionalLevels) {
        if (depthOf(parent) + additionalLevels > MAX_FOLDER_DEPTH) {
            throw new IllegalArgumentException(
                    "Folder nesting exceeds the maximum folder depth of " + MAX_FOLDER_DEPTH);
        }
    }

    private static void assertNoCycle(MediaFolder parent, Long folderId) {
        MediaFolder current = parent;
        while (current != null) {
            if (current.getId().equals(folderId)) {
                throw new IllegalArgumentException("Folder parent assignment would create a cycle");
            }
            current = current.getParent();
        }
    }

    private void assertNameAvailable(Long tenantId, MediaFolder parent, String name, Long selfId) {
        boolean taken = selfId == null
                ? parent == null
                        ? mediaFolderRepository.existsByTenantIdAndParentIdIsNullAndName(tenantId, name)
                        : mediaFolderRepository.existsByTenantIdAndParentAndName(tenantId, parent, name)
                : parent == null
                        ? mediaFolderRepository.existsByTenantIdAndParentIdIsNullAndNameAndIdNot(
                                tenantId, name, selfId)
                        : mediaFolderRepository.existsByTenantIdAndParentAndNameAndIdNot(
                                tenantId, parent, name, selfId);
        if (taken) {
            throw new ConflictException(
                    ConflictCodes.MEDIA_FOLDER_NAME_EXISTS,
                    "A folder named '" + name + "' already exists in this location");
        }
    }

    // Serializes concurrent tree mutations per tenant so two racing moves can't each pass
    // the in-memory cycle/depth check against stale data and jointly commit a violation.
    private void acquireTenantFolderLock(Long tenantId) {
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(?, ?)")
                .setParameter(1, MEDIA_FOLDER_LOCK_NAMESPACE)
                .setParameter(2, tenantId.intValue())
                .getSingleResult();
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Folder name is required");
        }
        String normalized = name.trim();
        if (normalized.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Folder name must be at most 255 characters");
        }
        return normalized;
    }
}
