package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.TenantLookupService;
import de.pnnit.directwerk.modules.digital.api.MediaAssetLifecycleApi;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.AssetAccessDeniedException;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.job.MediaDeleteJobProducer;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
class MediaAssetLifecycleServiceTest {

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    @Mock
    private TenantLookupService tenantLookupService;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private MediaDeleteJobProducer mediaDeleteJobProducer;

    private MediaAssetLifecycleService lifecycleService;
    private Tenant tenant;

    @BeforeEach
    void setUp() {
        lifecycleService = new MediaAssetLifecycleService(
                mediaAssetRepository,
                tenantLookupService,
                directwerkConfig,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                mediaDeleteJobProducer
        );
        tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha-show-a");
        TenantContext.setTenantId(10L);
    }

    @AfterEach
    void clear() {
        TenantContext.clear();
    }

    @Test
    void platformOpsQueuesPublicAssetDeleteWithCdnUrl() {
        MediaAsset asset = publicReadyAsset(55L);
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantLookupService.requireTenant(10L)).thenReturn(tenant);
        when(mediaAssetRepository.findById(55L)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MediaAsset result = lifecycleService.delete(new MediaAssetLifecycleApi.DeleteCommand(55L, null, true));

        assertThat(result.getStatus()).isEqualTo(AssetStatus.PENDING_DELETE);
        verify(mediaDeleteJobProducer).enqueueS3Delete(
                eq(55L),
                eq("alpha-show-a/public/images/cover.jpg"),
                eq("https://cdn.example.test/alpha-show-a/public/images/cover.jpg")
        );
    }

    @Test
    void editorCanQueueContentAssetDeleteWithoutCdnUrl() {
        MediaAsset asset = privateContentAsset(70L);
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantLookupService.requireTenant(10L)).thenReturn(tenant);
        when(mediaAssetRepository.findById(70L)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MediaAsset result = lifecycleService.delete(
                new MediaAssetLifecycleApi.DeleteCommand(70L, editor(3L), false)
        );

        assertThat(result.getStatus()).isEqualTo(AssetStatus.PENDING_DELETE);
        verify(mediaDeleteJobProducer).enqueueS3Delete(
                eq(70L),
                eq("alpha-show-a/private/audio/ep.mp3"),
                isNull()
        );
    }

    @Test
    void ownerCanQueueUserScopedAssetDelete() {
        MediaAsset asset = userScopedAsset(80L, 3L);
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantLookupService.requireTenant(10L)).thenReturn(tenant);
        when(mediaAssetRepository.findById(80L)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MediaAsset result = lifecycleService.delete(
                new MediaAssetLifecycleApi.DeleteCommand(80L, editor(3L), false)
        );

        assertThat(result.getStatus()).isEqualTo(AssetStatus.PENDING_DELETE);
        verify(mediaDeleteJobProducer).enqueueS3Delete(eq(80L), any(), isNull());
    }

    @Test
    void editorDeniedDeletingForeignUserAsset() {
        MediaAsset asset = userScopedAsset(81L, 99L);
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantLookupService.requireTenant(10L)).thenReturn(tenant);
        when(mediaAssetRepository.findById(81L)).thenReturn(Optional.of(asset));

        assertThatThrownBy(() -> lifecycleService.delete(
                new MediaAssetLifecycleApi.DeleteCommand(81L, editor(3L), false)
        )).isInstanceOf(AssetAccessDeniedException.class);

        verify(mediaDeleteJobProducer, never()).enqueueS3Delete(any(), any(), any());
    }

    @Test
    void tenantAdminCanOverrideUserScopedAsset() {
        MediaAsset asset = userScopedAsset(82L, 99L);
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantLookupService.requireTenant(10L)).thenReturn(tenant);
        when(mediaAssetRepository.findById(82L)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MediaAsset result = lifecycleService.delete(
                new MediaAssetLifecycleApi.DeleteCommand(82L, tenantAdmin(1L), false)
        );

        assertThat(result.getStatus()).isEqualTo(AssetStatus.PENDING_DELETE);
    }

    @Test
    void alreadyArchivedReturnsNotFound() {
        MediaAsset asset = publicReadyAsset(90L);
        asset.setStatus(AssetStatus.ARCHIVED);
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantLookupService.requireTenant(10L)).thenReturn(tenant);
        when(mediaAssetRepository.findById(90L)).thenReturn(Optional.of(asset));

        assertThatThrownBy(() -> lifecycleService.delete(
                new MediaAssetLifecycleApi.DeleteCommand(90L, null, true)
        )).isInstanceOf(MediaAssetNotFoundException.class);

        verify(mediaDeleteJobProducer, never()).enqueueS3Delete(any(), any(), any());
    }

    @Test
    void alreadyPendingDeleteIsIdempotent() {
        MediaAsset asset = publicReadyAsset(91L);
        asset.setStatus(AssetStatus.PENDING_DELETE);
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantLookupService.requireTenant(10L)).thenReturn(tenant);
        when(mediaAssetRepository.findById(91L)).thenReturn(Optional.of(asset));

        MediaAsset result = lifecycleService.delete(
                new MediaAssetLifecycleApi.DeleteCommand(91L, null, true)
        );

        assertThat(result.getStatus()).isEqualTo(AssetStatus.PENDING_DELETE);
        verify(mediaDeleteJobProducer, never()).enqueueS3Delete(any(), any(), any());
    }

    private static MediaAsset publicReadyAsset(Long id) {
        MediaAsset asset = new MediaAsset();
        asset.setId(id);
        Tenant t = new Tenant();
        t.setId(10L);
        t.setSlug("alpha-show-a");
        asset.setTenant(t);
        asset.setS3Key("alpha-show-a/public/images/cover.jpg");
        asset.setVisibility(AssetVisibility.PUBLIC);
        asset.setScope(AssetScope.TENANT_PUBLIC);
        asset.setAssetType(AssetType.IMAGE);
        asset.setStatus(AssetStatus.READY);
        asset.setOriginalFilename("cover.jpg");
        return asset;
    }

    private static MediaAsset privateContentAsset(Long id) {
        MediaAsset asset = publicReadyAsset(id);
        asset.setVisibility(AssetVisibility.PRIVATE);
        asset.setScope(AssetScope.CONTENT);
        asset.setS3Key("alpha-show-a/private/audio/ep.mp3");
        asset.setAssetType(AssetType.AUDIO);
        return asset;
    }

    private static MediaAsset userScopedAsset(Long id, Long ownerUserId) {
        MediaAsset asset = publicReadyAsset(id);
        asset.setVisibility(AssetVisibility.PRIVATE);
        asset.setScope(AssetScope.USER);
        asset.setOwnerUserId(ownerUserId);
        asset.setS3Key("alpha-show-a/private/user/" + ownerUserId + "/file.bin");
        return asset;
    }

    private static DirectwerkUserPrincipal editor(Long userId) {
        return new DirectwerkUserPrincipal(
                userId,
                "editor@example.com",
                "hash",
                10L,
                List.of(new SimpleGrantedAuthority(RoleConstants.EDITOR))
        );
    }

    private static DirectwerkUserPrincipal tenantAdmin(Long userId) {
        return new DirectwerkUserPrincipal(
                userId,
                "admin@example.com",
                "hash",
                10L,
                List.of(new SimpleGrantedAuthority(RoleConstants.TENANT_ADMIN))
        );
    }

    private static DirectwerkProperties.Storage storageProps() {
        return new DirectwerkProperties.Storage(
                true,
                "bunny",
                "de",
                "directwerk-dev",
                null,
                "https://de-s3.storage.bunnycdn.com",
                true,
                "zone",
                "password",
                "https://cdn.example.test",
                null,
                null,
                Duration.ofMinutes(15),
                Duration.ofHours(1),
                Duration.ofHours(24),
                24,
                "purge-key",
                "https://api.bunny.net"
        );
    }
}
