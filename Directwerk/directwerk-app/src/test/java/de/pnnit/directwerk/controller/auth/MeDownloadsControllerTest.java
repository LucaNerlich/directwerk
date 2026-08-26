package de.pnnit.directwerk.controller.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.access.SubscriberContentAccessService;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.controller.auth.MeDownloadsController.DownloadView;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
class MeDownloadsControllerTest {

    @Mock
    private SubscriberContentAccessService subscriberContentAccessService;

    private MeDownloadsController controller;

    @BeforeEach
    void setUp() {
        controller = new MeDownloadsController(subscriberContentAccessService);
    }

    @Test
    void listDownloadsMapsAccessResultsToViews() throws Exception {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        MediaAsset ready = asset(71L, AssetStatus.READY, "bonus.pdf");
        when(subscriberContentAccessService.listDownloads(principal)).thenReturn(List.of(
                new SubscriberContentAccessService.AssetDownload(
                        ready,
                        URI.create("https://cdn.example.test/bonus.pdf").toURL())
        ));

        ResponseEntity<Response<List<DownloadView>>> response = controller.listDownloads(principal);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().data()).hasSize(1);
        assertThat(response.getBody().data().getFirst().title()).isEqualTo("bonus.pdf");
        assertThat(response.getBody().data().getFirst().downloadUrl())
                .isEqualTo("https://cdn.example.test/bonus.pdf");
    }

    @Test
    void listDownloadsReturnsEmptyListWhenNothingAccessible() {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        // Fail-closed skipping lives in the access module; the controller sees an empty list.
        when(subscriberContentAccessService.listDownloads(principal)).thenReturn(List.of());

        ResponseEntity<Response<List<DownloadView>>> response = controller.listDownloads(principal);

        assertThat(response.getBody().data()).isEmpty();
    }

    private static DirectwerkUserPrincipal principal(Long userId, Long tenantId) {
        return new DirectwerkUserPrincipal(
                userId,
                "user-" + userId + "@example.test",
                "hash",
                tenantId,
                List.of(new SimpleGrantedAuthority(RoleConstants.SUBSCRIBER))
        );
    }

    private static MediaAsset asset(Long id, AssetStatus status, String filename) {
        MediaAsset mediaAsset = new MediaAsset();
        mediaAsset.setId(id);
        mediaAsset.setStatus(status);
        mediaAsset.setAssetType(AssetType.DOCUMENT);
        mediaAsset.setOriginalFilename(filename);
        mediaAsset.setMimeType("application/pdf");
        mediaAsset.setSizeBytes(1024L);
        return mediaAsset;
    }
}
