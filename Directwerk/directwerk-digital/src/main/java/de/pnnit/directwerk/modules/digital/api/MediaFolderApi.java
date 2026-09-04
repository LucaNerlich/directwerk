package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.entity.MediaFolder;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.util.List;

/**
 * Tenant-scoped media library folders. Folders are organization metadata only —
 * asset S3 keys stay flat, so moves are single-row updates.
 */
public interface MediaFolderApi {

    List<MediaFolder> list(Long tenantId);

    MediaFolder requireFolder(Long tenantId, Long folderId);

    MediaFolder createFolder(Long tenantId, String name, Long parentId);

    MediaFolder renameFolder(Long tenantId, Long folderId, String name);

    /**
     * Moves a folder to a new parent. A {@code null} parent moves it to the library root.
     */
    MediaFolder moveFolder(Long tenantId, Long folderId, Long newParentId);

    /**
     * Deletes a folder. Depending on {@code mode}, contents move up to the parent
     * (or root) or are deleted through the asset lifecycle.
     *
     * @return the removed folder for response mapping
     */
    MediaFolder deleteFolder(
            Long tenantId, Long folderId, FolderDeleteMode mode, DirectwerkUserPrincipal principal);

    /**
     * Assigns an asset to a folder. A {@code null} folder moves it to the library root.
     */
    MediaAsset moveAsset(Long tenantId, Long assetId, Long folderId);
}
