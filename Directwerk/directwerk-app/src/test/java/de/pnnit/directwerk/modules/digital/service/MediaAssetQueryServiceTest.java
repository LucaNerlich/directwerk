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
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class MediaAssetQueryServiceTest {

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    @Mock
    private TenantRepository tenantRepository;

    private MediaAssetQueryService service;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        service = new MediaAssetQueryService(mediaAssetRepository, tenantRepository);
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
}
