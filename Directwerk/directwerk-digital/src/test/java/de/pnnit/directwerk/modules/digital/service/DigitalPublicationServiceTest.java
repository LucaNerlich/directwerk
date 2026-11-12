package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.DigitalPublication;
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

    private static DigitalPublication publication(DigitalPublicationStatus status) {
        DigitalPublication publication = new DigitalPublication();
        publication.setStatus(status);
        return publication;
    }
}
