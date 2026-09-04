package de.pnnit.directwerk.modules.digital.service;

import static de.pnnit.directwerk.testsupport.RbacTestFixtures.override;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.audit.PlatformAuditService;
import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.RestrictionScope;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.exception.ContentAccessDeniedException;
import de.pnnit.directwerk.modules.core.repository.MembershipPermissionOverrideRepository;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.api.FolderDeleteMode;
import de.pnnit.directwerk.modules.digital.api.MediaAssetLifecycleApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.entity.MediaFolder;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.MediaFolderNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.repository.MediaFolderRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.security.core.context.SecurityContextHolder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MediaFolderServiceTest {

    @Mock
    private MediaFolderRepository mediaFolderRepository;

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    @Mock
    private MediaAssetLifecycleApi mediaAssetLifecycleApi;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private EntityManager entityManager;
    @Mock
    private PlatformAuditService platformAuditService;

    @Mock
    private MembershipPermissionOverrideRepository overrideRepository;

    @Mock
    private TenantMembershipRepository tenantMembershipRepository;


    private MediaFolderService service;

    @BeforeEach
    void setUp() {
        service = new MediaFolderService(
                mediaFolderRepository,
                mediaAssetRepository,
                mediaAssetLifecycleApi,
                tenantRepository,
                new MembershipPermissionService(
                        overrideRepository, tenantMembershipRepository, tenantRepository,
                        platformAuditService),
                entityManager);
        lenient().when(mediaFolderRepository.save(any(MediaFolder.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(mediaAssetRepository.save(any(MediaAsset.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        stubAdvisoryLock();
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createFolderTrimsNameAndDefaultsToRoot() {
        Tenant tenant = tenantWithId(10L);
        when(tenantRepository.getReferenceById(10L)).thenReturn(tenant);

        MediaFolder created = service.createFolder(10L, "  Interviews  ", null);

        assertThat(created.getName()).isEqualTo("Interviews");
        assertThat(created.getParent()).isNull();
        assertThat(created.getTenant()).isSameAs(tenant);
    }

    @Test
    void createFolderRejectsBlankName() {
        assertThatThrownBy(() -> service.createFolder(10L, "   ", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Folder name is required");
        verify(mediaFolderRepository, never()).save(any());
    }

    @Test
    void createFolderRejectsDuplicateRootName() {
        when(mediaFolderRepository.existsByTenantIdAndParentIdIsNullAndName(10L, "Audio")).thenReturn(true);

        assertThatThrownBy(() -> service.createFolder(10L, "Audio", null))
                .isInstanceOf(ConflictException.class)
                .extracting(ex -> ((ConflictException) ex).getCode())
                .isEqualTo(ConflictCodes.MEDIA_FOLDER_NAME_EXISTS);
        verify(mediaFolderRepository, never()).save(any());
    }

    @Test
    void createFolderRejectsDuplicateNestedName() {
        MediaFolder parent = folderWithId(1L);
        when(mediaFolderRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(parent));
        when(mediaFolderRepository.existsByTenantIdAndParentAndName(10L, parent, "Cuts"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.createFolder(10L, "Cuts", 1L))
                .isInstanceOf(ConflictException.class);
        verify(mediaFolderRepository, never()).save(any());
    }

    @Test
    void createFolderRejectsUnknownParent() {
        when(mediaFolderRepository.findByIdAndTenantId(99L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createFolder(10L, "Cuts", 99L))
                .isInstanceOf(MediaFolderNotFoundException.class);
    }

    @Test
    void createFolderRejectsDepthBeyondCap() {
        // Chain of 8 nested folders: creating below the deepest would reach depth 9.
        MediaFolder deepest = chainOfDepth(8);
        when(mediaFolderRepository.findByIdAndTenantId(80L, 10L)).thenReturn(Optional.of(deepest));

        assertThatThrownBy(() -> service.createFolder(10L, "Too deep", 80L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("maximum folder depth of 8");
        verify(mediaFolderRepository, never()).save(any());
    }

    @Test
    void renameFolderTrimsAndSaves() {
        MediaFolder folder = folderWithId(1L);
        when(mediaFolderRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(folder));

        MediaFolder renamed = service.renameFolder(10L, 1L, "  New name  ");

        assertThat(renamed.getName()).isEqualTo("New name");
    }

    @Test
    void renameFolderRejectsDuplicateSiblingName() {
        MediaFolder folder = folderWithId(1L);
        when(mediaFolderRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(folder));
        when(mediaFolderRepository.existsByTenantIdAndParentIdIsNullAndNameAndIdNot(10L, "Taken", 1L))
                .thenReturn(true);

        assertThatThrownBy(() -> service.renameFolder(10L, 1L, "Taken"))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void moveFolderRejectsItselfAsParent() {
        MediaFolder folder = folderWithId(5L);
        when(mediaFolderRepository.findByIdAndTenantId(5L, 10L)).thenReturn(Optional.of(folder));

        assertThatThrownBy(() -> service.moveFolder(10L, 5L, 5L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("own parent");
    }

    @Test
    void moveFolderRejectsParentCycle() {
        MediaFolder root = folderWithId(1L);
        MediaFolder child = folderWithId(2L);
        MediaFolder grandchild = folderWithId(3L);
        child.setParent(root);
        grandchild.setParent(child);

        when(mediaFolderRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(root));
        when(mediaFolderRepository.findByIdAndTenantId(3L, 10L)).thenReturn(Optional.of(grandchild));
        stubAdvisoryLock();

        assertThatThrownBy(() -> service.moveFolder(10L, 1L, 3L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cycle");
    }

    @Test
    void moveFolderRejectsDepthBeyondCap() {
        MediaFolder folder = folderWithId(1L);
        MediaFolder deepest = chainOfDepth(8);
        when(mediaFolderRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(folder));
        when(mediaFolderRepository.findByIdAndTenantId(80L, 10L)).thenReturn(Optional.of(deepest));
        // Subtree height lookup sees an empty tenant tree besides the chain.
        when(mediaFolderRepository.findByTenantIdOrderByNameAscIdAsc(10L)).thenReturn(List.of());
        stubAdvisoryLock();

        assertThatThrownBy(() -> service.moveFolder(10L, 1L, 80L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("maximum folder depth of 8");
    }

    @Test
    void moveFolderToRootClearsParent() {
        MediaFolder parent = folderWithId(2L);
        MediaFolder folder = folderWithId(1L);
        folder.setParent(parent);
        when(mediaFolderRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(folder));
        when(mediaFolderRepository.findByTenantIdOrderByNameAscIdAsc(10L)).thenReturn(List.of());
        stubAdvisoryLock();

        MediaFolder moved = service.moveFolder(10L, 1L, null);

        assertThat(moved.getParent()).isNull();
    }

    @Test
    void deleteFolderMovesContentsToParentByDefault() {
        MediaFolder grandparent = folderWithId(9L);
        MediaFolder folder = folderWithId(1L);
        folder.setParent(grandparent);
        MediaFolder child = folderWithId(2L);
        child.setParent(folder);
        MediaAsset asset = assetWithId(7L, 10L);
        asset.setFolderId(1L);

        when(mediaFolderRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(folder));
        when(mediaFolderRepository.findByTenantIdAndParent(10L, folder)).thenReturn(List.of(child));
        when(mediaAssetRepository.findByTenantIdAndFolderId(10L, 1L)).thenReturn(List.of(asset));
        stubAdvisoryLock();

        service.deleteFolder(10L, 1L, FolderDeleteMode.MOVE_TO_PARENT, null);

        assertThat(child.getParent()).isSameAs(grandparent);
        assertThat(asset.getFolderId()).isEqualTo(9L);
        verify(mediaFolderRepository).delete(folder);
        verify(mediaAssetLifecycleApi, never()).delete(any());
    }

    @Test
    void deleteRootFolderMovesContentsToRoot() {
        MediaFolder folder = folderWithId(1L);
        MediaFolder child = folderWithId(2L);
        child.setParent(folder);
        MediaAsset asset = assetWithId(7L, 10L);
        asset.setFolderId(1L);

        when(mediaFolderRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(folder));
        when(mediaFolderRepository.findByTenantIdAndParent(10L, folder)).thenReturn(List.of(child));
        when(mediaAssetRepository.findByTenantIdAndFolderId(10L, 1L)).thenReturn(List.of(asset));
        stubAdvisoryLock();

        service.deleteFolder(10L, 1L, FolderDeleteMode.MOVE_TO_PARENT, null);

        assertThat(child.getParent()).isNull();
        assertThat(asset.getFolderId()).isNull();
    }

    @Test
    void deleteFolderRejectsPromotedChildNameCollisionBeforeMutation() {
        MediaFolder parent = folderWithId(9L);
        MediaFolder folder = folderWithId(1L);
        folder.setParent(parent);
        MediaFolder child = folderWithId(2L);
        child.setName("Taken");
        child.setParent(folder);
        MediaFolder sibling = folderWithId(3L);
        sibling.setName("Taken");
        sibling.setParent(parent);

        when(mediaFolderRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(folder));
        when(mediaFolderRepository.findByTenantIdAndParent(10L, folder)).thenReturn(List.of(child));
        when(mediaFolderRepository.findByTenantIdAndParent(10L, parent))
                .thenReturn(List.of(folder, sibling));

        assertThatThrownBy(() -> service.deleteFolder(
                10L, 1L, FolderDeleteMode.MOVE_TO_PARENT, null))
                .isInstanceOf(ConflictException.class)
                .extracting(ex -> ((ConflictException) ex).getCode())
                .isEqualTo(ConflictCodes.MEDIA_FOLDER_NAME_EXISTS);
        verify(mediaFolderRepository, never()).save(any());
        verify(mediaFolderRepository, never()).delete(any());
    }

    @Test
    void deleteFolderWithContentsDeletesAssetsDeepestFirst() {
        MediaFolder folder = folderWithId(1L);
        MediaFolder child = folderWithId(2L);
        child.setParent(folder);
        MediaAsset rootAsset = assetWithId(7L, 10L);
        rootAsset.setFolderId(1L);
        MediaAsset childAsset = assetWithId(8L, 10L);
        childAsset.setFolderId(2L);

        when(mediaFolderRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(folder));
        when(mediaFolderRepository.findByTenantIdOrderByNameAscIdAsc(10L))
                .thenReturn(List.of(folder, child));
        when(mediaAssetRepository.findByTenantIdAndFolderId(10L, 1L)).thenReturn(List.of(rootAsset));
        when(mediaAssetRepository.findByTenantIdAndFolderId(10L, 2L)).thenReturn(List.of(childAsset));
        stubAdvisoryLock();

        service.deleteFolder(10L, 1L, FolderDeleteMode.DELETE_CONTENTS, null);

        verify(mediaAssetLifecycleApi).delete(
                new MediaAssetLifecycleApi.DeleteCommand(8L, null, false));
        verify(mediaAssetLifecycleApi).delete(
                new MediaAssetLifecycleApi.DeleteCommand(7L, null, false));
        InOrder folderOrder = inOrder(mediaFolderRepository);
        folderOrder.verify(mediaFolderRepository).delete(child);
        folderOrder.verify(mediaFolderRepository).delete(folder);
    }

    @Test
    void moveAssetAssignsFolder() {
        MediaAsset asset = assetWithId(7L, 10L);
        MediaFolder folder = folderWithId(3L);
        when(mediaAssetRepository.findById(7L)).thenReturn(Optional.of(asset));
        when(mediaFolderRepository.findByIdAndTenantId(3L, 10L)).thenReturn(Optional.of(folder));

        MediaAsset moved = service.moveAsset(10L, 7L, 3L);

        assertThat(moved.getFolderId()).isEqualTo(3L);
    }

    @Test
    void folderCreationAcquiresDeletionLockBeforeResolvingParent() {
        MediaFolder parent = folderWithId(3L);
        when(mediaFolderRepository.findByIdAndTenantId(3L, 10L)).thenReturn(Optional.of(parent));
        when(tenantRepository.getReferenceById(10L)).thenReturn(tenantWithId(10L));

        service.createFolder(10L, "Child", 3L);

        InOrder order = inOrder(entityManager, mediaFolderRepository);
        order.verify(entityManager).createNativeQuery(any(String.class));
        order.verify(mediaFolderRepository).findByIdAndTenantId(3L, 10L);
    }

    @Test
    void assetMovementAcquiresDeletionLockBeforeLoadingAsset() {
        MediaAsset asset = assetWithId(7L, 10L);
        when(mediaAssetRepository.findById(7L)).thenReturn(Optional.of(asset));

        service.moveAsset(10L, 7L, null);

        InOrder order = inOrder(entityManager, mediaAssetRepository);
        order.verify(entityManager).createNativeQuery(any(String.class));
        order.verify(mediaAssetRepository).findById(7L);
    }

    @Test
    void uploadFolderAssignmentUsesDeletionLockBeforeValidation() {
        MediaAsset asset = assetWithId(7L, 10L);
        MediaFolder folder = folderWithId(3L);
        when(mediaFolderRepository.findByIdAndTenantId(3L, 10L)).thenReturn(Optional.of(folder));

        service.assignAssetToFolder(10L, asset, 3L);

        assertThat(asset.getFolderId()).isEqualTo(3L);
        InOrder order = inOrder(entityManager, mediaFolderRepository);
        order.verify(entityManager).createNativeQuery(any(String.class));
        order.verify(mediaFolderRepository).findByIdAndTenantId(3L, 10L);
    }

    @Test
    void moveAssetToRootClearsFolder() {
        MediaAsset asset = assetWithId(7L, 10L);
        asset.setFolderId(3L);
        when(mediaAssetRepository.findById(7L)).thenReturn(Optional.of(asset));

        MediaAsset moved = service.moveAsset(10L, 7L, null);

        assertThat(moved.getFolderId()).isNull();
    }

    @Test
    void moveAssetRejectsForeignTenantAsset() {
        MediaAsset asset = assetWithId(7L, 99L);
        when(mediaAssetRepository.findById(7L)).thenReturn(Optional.of(asset));

        assertThatThrownBy(() -> service.moveAsset(10L, 7L, null))
                .isInstanceOf(MediaAssetNotFoundException.class);
    }

    @Test
    void moveAssetRejectsTombstonedAsset() {
        MediaAsset asset = assetWithId(7L, 10L);
        asset.setStatus(AssetStatus.ARCHIVED);
        when(mediaAssetRepository.findById(7L)).thenReturn(Optional.of(asset));

        assertThatThrownBy(() -> service.moveAsset(10L, 7L, null))
                .isInstanceOf(MediaAssetNotFoundException.class);
    }

    @Test
    void moveAssetRejectsUnknownFolder() {
        MediaAsset asset = assetWithId(7L, 10L);
        when(mediaAssetRepository.findById(7L)).thenReturn(Optional.of(asset));
        when(mediaFolderRepository.findByIdAndTenantId(99L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.moveAsset(10L, 7L, 99L))
                .isInstanceOf(MediaFolderNotFoundException.class);
    }

    private void stubAdvisoryLock() {
        Query query = mock(Query.class);
        lenient().when(entityManager.createNativeQuery(any(String.class))).thenReturn(query);
        lenient().when(query.setParameter(anyInt(), any())).thenReturn(query);
        lenient().when(query.getSingleResult()).thenReturn(null);
    }

    private static Tenant tenantWithId(Long id) {
        Tenant tenant = new Tenant();
        tenant.setId(id);
        return tenant;
    }

    private static MediaFolder folderWithId(Long id) {
        MediaFolder folder = new MediaFolder();
        folder.setId(id);
        folder.setName("Folder " + id);
        return folder;
    }

    /** A root-anchored chain of the given depth; the deepest folder keeps the highest id. */
    private static MediaFolder chainOfDepth(int depth) {
        MediaFolder parent = null;
        MediaFolder current = null;
        for (int level = 1; level <= depth; level++) {
            current = folderWithId((long) (level * 10));
            current.setParent(parent);
            parent = current;
        }
        return current;
    }

    private static MediaAsset assetWithId(Long id, Long tenantId) {
        MediaAsset asset = new MediaAsset();
        asset.setId(id);
        asset.setTenant(tenantWithId(tenantId));
        asset.setStatus(AssetStatus.READY);
        return asset;
    }

    @Test
    void moveFolderDeniedForStrangerWithOwnOnlyRestriction() {        MediaFolder folder = folderWithId(1L);
        folder.setCreatedBy(99L);
        when(mediaFolderRepository.findByIdAndTenantId(1L, 10L)).thenReturn(Optional.of(folder));
        when(overrideRepository.findByTenantIdAndUserId(10L, 5L)).thenReturn(List.of(
                override(ContentEntityType.MEDIA_FOLDER, ContentOperation.MOVE, RestrictionScope.OTHERS_ONLY)));
        authenticate(10L, 5L, Role.EDITOR);

        assertThatThrownBy(() -> service.moveFolder(10L, 1L, null))
                .isInstanceOf(ContentAccessDeniedException.class)
                .extracting(ex -> ((ContentAccessDeniedException) ex).getCode())
                .isEqualTo(ContentAccessDeniedException.NOT_CONTENT_OWNER);
    }

    @Test
    void createFolderDeniedWithDenyOverride() {
        when(overrideRepository.findByTenantIdAndUserId(10L, 5L)).thenReturn(List.of(
                override(ContentEntityType.MEDIA_FOLDER, ContentOperation.CREATE, RestrictionScope.DENY)));
        authenticate(10L, 5L, Role.EDITOR);

        assertThatThrownBy(() -> service.createFolder(10L, "Neu", null))
                .isInstanceOf(ContentAccessDeniedException.class);
        verify(mediaFolderRepository, never()).save(any(MediaFolder.class));
    }

    private static void authenticate(Long tenantId, Long userId, Role... roles) {
        java.util.List<org.springframework.security.core.authority.SimpleGrantedAuthority> authorities =
                java.util.Arrays.stream(roles)
                        .map(role -> new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "ROLE_" + role.name()))
                        .toList();
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                userId, "user@example.com", "hash", tenantId, authorities);
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        principal, null, authorities));
    }

}
