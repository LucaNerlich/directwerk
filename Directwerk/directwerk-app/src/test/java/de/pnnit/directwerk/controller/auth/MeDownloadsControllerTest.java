package de.pnnit.directwerk.controller.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.controller.auth.MeDownloadsController.DownloadView;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.EntitlementDeniedException;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.net.URI;
import java.util.List;
import java.util.Optional;
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
    private EntitlementService entitlementService;

    @Mock
    private MediaAssetQueryApi mediaAssetQueryApi;

    @Mock
    private AssetAccessApi assetAccessApi;

    @Mock
    private ModuleGateService moduleGateService;

    private MeDownloadsController controller;

    @BeforeEach
    void setUp() {
        controller = new MeDownloadsController(
                entitlementService,
                mediaAssetQueryApi,
                assetAccessApi,
                moduleGateService
        );
    }

    @Test
    void listDownloadsReturnsAuthorizedReadyAssets() throws Exception {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        MediaAsset ready = asset(71L, AssetStatus.READY, "bonus.pdf");
        MediaAsset pending = asset(72L, AssetStatus.PENDING, "soon.pdf");
        when(entitlementService.listEntitledDigitalAssetIds(5L, 1L)).thenReturn(List.of(71L, 72L, 73L));
        when(mediaAssetQueryApi.findById(71L)).thenReturn(Optional.of(ready));
        when(mediaAssetQueryApi.findById(72L)).thenReturn(Optional.of(pending));
        when(mediaAssetQueryApi.findById(73L)).thenReturn(Optional.empty());
        when(assetAccessApi.resolveDownloadUrl(ready, principal))
                .thenReturn(URI.create("https://cdn.example.test/bonus.pdf").toURL());

        ResponseEntity<Response<List<DownloadView>>> response = controller.listDownloads(principal);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().data()).hasSize(1);
        assertThat(response.getBody().data().getFirst().title()).isEqualTo("bonus.pdf");
        assertThat(response.getBody().data().getFirst().downloadUrl())
                .isEqualTo("https://cdn.example.test/bonus.pdf");
    }

    @Test
    void listDownloadsSkipsAssetsDeniedAtDownloadTime() throws Exception {
        DirectwerkUserPrincipal principal = principal(1L, 5L);
        MediaAsset ready = asset(71L, AssetStatus.READY, "secret.pdf");
        when(entitlementService.listEntitledDigitalAssetIds(5L, 1L)).thenReturn(List.of(71L));
        when(mediaAssetQueryApi.findById(71L)).thenReturn(Optional.of(ready));
        when(assetAccessApi.resolveDownloadUrl(ready, principal))
                .thenThrow(new EntitlementDeniedException(71L));

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
