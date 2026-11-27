package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.DigitalPublication;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.entity.DigitalPublicationStatus;
import de.pnnit.directwerk.modules.digital.repository.DigitalPublicationRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DigitalPublicationServiceTest {

    @Mock
    private DigitalPublicationRepository digitalPublicationRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private MediaAssetQueryApi mediaAssetQueryApi;

    @Mock
    private MembershipPermissionService permissionService;

    @InjectMocks
    private DigitalPublicationService service;

    @Test
    void archiveRejectsDraftBonusFile() {
        DigitalPublication publication = publication(DigitalPublicationStatus.DRAFT);
        when(digitalPublicationRepository.findByIdAndTenant_Id(1L, 7L))
                .thenReturn(Optional.of(publication));

        assertThatThrownBy(() -> service.archive(7L, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("published");
        verify(digitalPublicationRepository, never()).save(publication);
    }

    @Test
    void archiveMovesPublishedBonusFileToArchived() {
        DigitalPublication publication = publication(DigitalPublicationStatus.PUBLISHED);
        when(digitalPublicationRepository.findByIdAndTenant_Id(1L, 7L))
                .thenReturn(Optional.of(publication));
        when(digitalPublicationRepository.save(publication)).thenReturn(publication);

        DigitalPublication archived = service.archive(7L, 1L);

        assertThat(archived.getStatus()).isEqualTo(DigitalPublicationStatus.ARCHIVED);
    }

    @Test
    void publishRejectsAPublicAssetForAPaidPublication() {
        DigitalPublication publication = publication(DigitalPublicationStatus.DRAFT);
        publication.setAccessPolicy(AccessPolicy.PAID);
        MediaAsset asset = new MediaAsset();
        asset.setId(9L);
        asset.setAssetType(AssetType.DOCUMENT);
        asset.setStatus(AssetStatus.READY);
        asset.setVisibility(AssetVisibility.PUBLIC);
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        asset.setTenant(tenant);
        publication.setAsset(asset);

        when(digitalPublicationRepository.findByIdAndTenant_Id(1L, 7L))
                .thenReturn(Optional.of(publication));
        when(mediaAssetQueryApi.findById(9L)).thenReturn(Optional.of(asset));

        assertThatThrownBy(() -> service.publish(7L, 1L))
                .isInstanceOf(de.pnnit.directwerk.modules.digital.exception.DigitalPublicationValidationException.class)
                .hasMessageContaining("asset 9");
        verify(digitalPublicationRepository, never()).save(publication);
    }

    @Test
    void publishAcceptsAPaidPublicationWithAPrivateAsset() {
        DigitalPublication publication = publication(DigitalPublicationStatus.DRAFT);
        publication.setAccessPolicy(AccessPolicy.PAID);
        MediaAsset asset = new MediaAsset();
        asset.setId(9L);
        asset.setAssetType(AssetType.DOCUMENT);
        asset.setStatus(AssetStatus.READY);
        asset.setVisibility(AssetVisibility.PRIVATE);
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        asset.setTenant(tenant);
        publication.setAsset(asset);

        when(digitalPublicationRepository.findByIdAndTenant_Id(1L, 7L))
                .thenReturn(Optional.of(publication));
        when(mediaAssetQueryApi.findById(9L)).thenReturn(Optional.of(asset));
        when(digitalPublicationRepository.save(publication)).thenReturn(publication);

        DigitalPublication published = service.publish(7L, 1L);

        assertThat(published.getStatus()).isEqualTo(DigitalPublicationStatus.PUBLISHED);
        assertThat(published.getPublishedAt()).isNotNull();
        // PAID without an explicit level defaults to the base level.
        assertThat(published.getRequiredLevelSortOrder()).isZero();
    }

    private static DigitalPublication publication(DigitalPublicationStatus status) {
        DigitalPublication publication = new DigitalPublication();
        publication.setStatus(status);
        return publication;
    }
}
