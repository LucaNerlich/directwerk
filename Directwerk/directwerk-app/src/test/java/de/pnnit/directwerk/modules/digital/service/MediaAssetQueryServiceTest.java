package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.entity.MediaFolder;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi.MediaAssetReference;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.MediaFolderNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.repository.MediaFolderRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class MediaAssetQueryServiceTest {

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    @Mock
    private MediaFolderRepository mediaFolderRepository;

    @Mock
    private TenantRepository tenantRepository;

    private MediaAssetQueryService service;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        service = new MediaAssetQueryService(mediaAssetRepository, mediaFolderRepository, tenantRepository);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listForTenantAppliesTenantContextWhileQuerying() {
        Tenant tenant = new Tenant();
        tenant.setId(42L);
        when(tenantRepository.requireById(42L)).thenReturn(tenant);

        AtomicReference<Long> seenTenantId = new AtomicReference<>();
        when(mediaAssetRepository.findFiltered(eq(AssetType.IMAGE), isNull(), any(Pageable.class)))
                .thenAnswer(invocation -> {
                    seenTenantId.set(TenantContext.getTenantId());
                    MediaAsset asset = new MediaAsset();
                    asset.setId(7L);
                    return List.of(asset);
                });

        List<MediaAsset> result = service.listForTenant(42L, AssetType.IMAGE, null, 20);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().getId()).isEqualTo(7L);
        assertThat(seenTenantId.get()).isEqualTo(42L);
        assertThat(TenantContext.getTenantId()).isNull();
        verify(tenantRepository).requireById(42L);
    }

    @Test
    void listForTenantPropagatesMissingTenant() {
        when(tenantRepository.requireById(99L))
                .thenThrow(new IllegalArgumentException("Tenant not found"));

        assertThatThrownBy(() -> service.listForTenant(99L, null, AssetStatus.READY, 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Tenant not found");
    }

    @Test
    void findByIdReturnsAssetForSameTenant() {
        Tenant tenant = new Tenant();
        tenant.setId(42L);
        MediaAsset asset = new MediaAsset();
        asset.setId(7L);
        asset.setTenant(tenant);
        when(mediaAssetRepository.findById(7L)).thenReturn(java.util.Optional.of(asset));

        TenantContext.setTenantId(42L);

        assertThat(service.findById(7L)).contains(asset);
    }

    @Test
    void findByIdReturnsEmptyForForeignTenant() {
        // Regression: Hibernate filters do not apply to EntityManager.find()
        // (the path behind repository findById), so without an explicit
        // TenantContext check any editor could read another tenant's asset
        // metadata (incl. s3Key) by ID. Callers map empty to 404.
        Tenant otherTenant = new Tenant();
        otherTenant.setId(99L);
        MediaAsset asset = new MediaAsset();
        asset.setId(7L);
        asset.setTenant(otherTenant);
        when(mediaAssetRepository.findById(7L)).thenReturn(java.util.Optional.of(asset));

        TenantContext.setTenantId(42L);

        assertThat(service.findById(7L)).isEmpty();
    }

    @Test
    void findByIdWithoutContextPreservesPlatformBehavior() {
        Tenant tenant = new Tenant();
        tenant.setId(42L);
        MediaAsset asset = new MediaAsset();
        asset.setId(7L);
        asset.setTenant(tenant);
        when(mediaAssetRepository.findById(7L)).thenReturn(java.util.Optional.of(asset));

        assertThat(service.findById(7L)).contains(asset);
    }

    @Test
    void listInFolderPagingUsesTheOffsetAsPageNumber() {
        when(mediaAssetRepository.findFiltered(eq(AssetType.IMAGE), isNull(), any(Pageable.class)))
                .thenReturn(List.of());

        service.listInFolder(AssetType.IMAGE, null, null, false, false, 50, 100);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(mediaAssetRepository).findFiltered(eq(AssetType.IMAGE), isNull(), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(2);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(50);
    }

    @Test
    void listInFolderRejectsFolderIdWithUnassignedOnly() {
        assertThatThrownBy(() -> service.listInFolder(null, null, 3L, false, true, 20))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("mutually exclusive");
    }

    @Test
    void listInFolderWithoutFilterDelegatesToUnfilteredList() {
        when(mediaAssetRepository.findFiltered(eq(AssetType.IMAGE), isNull(), any(Pageable.class)))
                .thenReturn(List.of());

        assertThat(service.listInFolder(AssetType.IMAGE, null, null, false, false, 20)).isEmpty();
        verify(mediaAssetRepository).findFiltered(eq(AssetType.IMAGE), isNull(), any(Pageable.class));
    }

    @Test
    void listInFolderWithUnassignedOnlyQueriesRootAssets() {
        when(mediaAssetRepository.findFilteredUnassigned(isNull(), eq(AssetStatus.READY), any(Pageable.class)))
                .thenReturn(List.of());

        assertThat(service.listInFolder(null, AssetStatus.READY, null, false, true, 20)).isEmpty();
        verify(mediaAssetRepository)
                .findFilteredUnassigned(isNull(), eq(AssetStatus.READY), any(Pageable.class));
    }

    @Test
    void listInFolderWithUnreferencedOnlyQueriesUnreferencedIdsAndHydrates() {
        TenantContext.setTenantId(42L);
        MediaAsset orphan = new MediaAsset();
        orphan.setId(11L);
        when(mediaAssetRepository.findFilteredUnreferencedIds(
                        eq(42L), eq("IMAGE"), isNull(), any(Pageable.class)))
                .thenReturn(List.of(11L));
        when(mediaAssetRepository.findAllWithTenantByIdIn(eq(List.of(11L))))
                .thenReturn(List.of(orphan));

        assertThat(service.listInFolder(AssetType.IMAGE, null, null, false, false, true, 20, 0))
                .containsExactly(orphan);
        verify(mediaAssetRepository)
                .findFilteredUnreferencedIds(eq(42L), eq("IMAGE"), isNull(), any(Pageable.class));
    }

    @Test
    void listInFolderWithUnreferencedAndUnassignedOnlyQueriesRootOrphans() {
        TenantContext.setTenantId(42L);
        when(mediaAssetRepository.findFilteredUnassignedUnreferencedIds(
                        eq(42L), isNull(), eq("READY"), any(Pageable.class)))
                .thenReturn(List.of());

        assertThat(service.listInFolder(null, AssetStatus.READY, null, false, true, true, 20, 0))
                .isEmpty();
        verify(mediaAssetRepository)
                .findFilteredUnassignedUnreferencedIds(
                        eq(42L), isNull(), eq("READY"), any(Pageable.class));
    }

    @Test
    void listInFolderQueriesExactFolder() {
        MediaFolder folder = new MediaFolder();
        folder.setId(3L);
        TenantContext.setTenantId(42L);
        when(mediaFolderRepository.findByIdAndTenantId(3L, 42L))
                .thenReturn(java.util.Optional.of(folder));
        when(mediaAssetRepository.findFilteredInFolders(
                        isNull(), isNull(), eq(List.of(3L)), any(Pageable.class)))
                .thenReturn(List.of());

        assertThat(service.listInFolder(null, null, 3L, false, false, 20)).isEmpty();
        verify(mediaAssetRepository)
                .findFilteredInFolders(isNull(), isNull(), eq(List.of(3L)), any(Pageable.class));
    }

    @Test
    void listInFolderRecursiveIncludesDescendants() {
        MediaFolder folder = new MediaFolder();
        folder.setId(3L);
        MediaFolder child = new MediaFolder();
        child.setId(4L);
        child.setParent(folder);
        TenantContext.setTenantId(42L);
        when(mediaFolderRepository.findByIdAndTenantId(3L, 42L))
                .thenReturn(java.util.Optional.of(folder));
        when(mediaFolderRepository.findByTenantIdOrderByNameAscIdAsc(42L))
                .thenReturn(List.of(folder, child));
        when(mediaAssetRepository.findFilteredInFolders(
                        isNull(), isNull(), eq(List.of(3L, 4L)), any(Pageable.class)))
                .thenReturn(List.of());

        assertThat(service.listInFolder(null, null, 3L, true, false, 20)).isEmpty();
        verify(mediaAssetRepository)
                .findFilteredInFolders(isNull(), isNull(), eq(List.of(3L, 4L)), any(Pageable.class));
    }

    @Test
    void listInFolderThrowsForUnknownFolder() {
        TenantContext.setTenantId(42L);
        when(mediaFolderRepository.findByIdAndTenantId(99L, 42L))
                .thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> service.listInFolder(null, null, 99L, false, false, 20))
                .isInstanceOf(MediaFolderNotFoundException.class);
    }

    @Test
    void listAttachedReferencesMapsRowsForTenantAsset() {
        Tenant tenant = new Tenant();
        tenant.setId(42L);
        MediaAsset asset = new MediaAsset();
        asset.setId(7L);
        asset.setTenant(tenant);
        TenantContext.setTenantId(42L);
        when(mediaAssetRepository.findById(7L)).thenReturn(java.util.Optional.of(asset));
        when(mediaAssetRepository.findAttachedReferences(7L)).thenReturn(List.of(
                new Object[] {"EPISODE_AUDIO", 11L, "Folge 1"},
                new Object[] {"ARTICLE_HERO", 22L, "Beitrag"}
        ));

        assertThat(service.listAttachedReferences(7L)).containsExactly(
                new MediaAssetReference("EPISODE_AUDIO", 11L, "Folge 1"),
                new MediaAssetReference("ARTICLE_HERO", 22L, "Beitrag")
        );
    }

    @Test
    void listAttachedReferencesReturnsEmptyWhenUnused() {
        Tenant tenant = new Tenant();
        tenant.setId(42L);
        MediaAsset asset = new MediaAsset();
        asset.setId(7L);
        asset.setTenant(tenant);
        TenantContext.setTenantId(42L);
        when(mediaAssetRepository.findById(7L)).thenReturn(java.util.Optional.of(asset));
        when(mediaAssetRepository.findAttachedReferences(7L)).thenReturn(List.of());

        assertThat(service.listAttachedReferences(7L)).isEmpty();
    }

    @Test
    void listAttachedReferencesThrowsForMissingOrForeignAsset() {
        TenantContext.setTenantId(42L);
        when(mediaAssetRepository.findById(7L)).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> service.listAttachedReferences(7L))
                .isInstanceOf(MediaAssetNotFoundException.class);
    }

    @Test
    void countActiveAssetsByFolderMapsRepositoryRowsAndOmitsEmptyFolders() {
        Tenant tenant = new Tenant();
        tenant.setId(42L);
        when(tenantRepository.requireById(42L)).thenReturn(tenant);
        when(mediaAssetRepository.countActiveByFolder(42L)).thenReturn(List.of(
                folderAssetCount(3L, 4L),
                folderAssetCount(9L, 1L)
        ));

        assertThat(service.countActiveAssetsByFolder(42L))
                .containsExactlyInAnyOrderEntriesOf(java.util.Map.of(3L, 4L, 9L, 1L));
    }

    @Test
    void countActiveAssetsInFolderDelegatesToRepository() {
        Tenant tenant = new Tenant();
        tenant.setId(42L);
        when(tenantRepository.requireById(42L)).thenReturn(tenant);
        when(mediaAssetRepository.countActiveByTenantIdAndFolderId(42L, 3L)).thenReturn(7L);

        assertThat(service.countActiveAssetsInFolder(42L, 3L)).isEqualTo(7L);
        assertThat(service.countActiveAssetsInFolder(42L, null)).isZero();
    }

    private static MediaAssetRepository.FolderAssetCount folderAssetCount(Long folderId, Long assetCount) {
        return new MediaAssetRepository.FolderAssetCount() {
            @Override
            public Long getFolderId() {
                return folderId;
            }

            @Override
            public Long getAssetCount() {
                return assetCount;
            }
        };
    }
}
