package de.pnnit.directwerk.controller.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.api.MediaAssetLifecycleApi;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.api.UploadApi;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PlatformTenantMediaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MediaAssetQueryApi mediaAssetQueryApi;

    @MockitoBean
    private UploadApi uploadApi;

    @MockitoBean
    private MediaAssetLifecycleApi mediaAssetLifecycleApi;

    @DynamicPropertySource
    static void registerEphemeralSecrets(DynamicPropertyRegistry registry) {
        String platformClientSecret = "test-platform-" + UUID.randomUUID();
        String tenantClientSecret = "test-tenant-" + UUID.randomUUID();
        registry.add("directwerk.security.platform-client-secret", () -> platformClientSecret);
        registry.add("directwerk.security.tenant-client-secret", () -> tenantClientSecret);
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void listMediaReturnsTenantAssetsForPlatformAdmin() throws Exception {
        MediaAsset asset = readyPublicImage(7L, "alpha");

        when(mediaAssetQueryApi.listForTenant(42L, AssetType.IMAGE, AssetStatus.READY, 20))
                .thenReturn(List.of(asset));

        mockMvc.perform(get("/api/v1/platform/tenants/42/media")
                        .param("assetType", "IMAGE")
                        .param("status", "READY")
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(7))
                .andExpect(jsonPath("$.data.content[0].originalFilename").value("cover.jpg"))
                .andExpect(jsonPath("$.data.content[0].assetType").value("IMAGE"))
                .andExpect(jsonPath("$.data.content[0].status").value("READY"))
                .andExpect(jsonPath("$.data.content[0].s3Key").value("alpha/public/images/cover.jpg"))
                .andExpect(jsonPath("$.data.content[0].cdnUrl")
                        .value("https://cdn.example.test/alpha/public/images/cover.jpg"))
                .andExpect(jsonPath("$.data.publicCdnBaseUrl")
                        .value("https://cdn.example.test"));

        verify(mediaAssetQueryApi).listForTenant(42L, AssetType.IMAGE, AssetStatus.READY, 20);
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void listMediaOmitsCdnUrlForPrivateAssets() throws Exception {
        MediaAsset privateAsset = readyPublicImage(8L, "alpha");
        privateAsset.setVisibility(AssetVisibility.PRIVATE);
        privateAsset.setScope(AssetScope.CONTENT);
        privateAsset.setS3Key("alpha/private/images/secret.jpg");

        when(mediaAssetQueryApi.listForTenant(42L, null, null, 50))
                .thenReturn(List.of(privateAsset));

        mockMvc.perform(get("/api/v1/platform/tenants/42/media"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(8))
                .andExpect(jsonPath("$.data.content[0].visibility").value("PRIVATE"))
                .andExpect(jsonPath("$.data.content[0].cdnUrl").doesNotExist());

        verify(mediaAssetQueryApi).listForTenant(42L, null, null, 50);
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void createUploadUrlReturnsPresignForPlatformAdmin() throws Exception {
        when(uploadApi.createUploadUrl(any())).thenReturn(new UploadApi.UploadUrlResult(
                55L,
                "https://de-s3.storage.bunnycdn.com/directwerk-test/alpha/staging/x/cover.jpg",
                Instant.parse("2026-07-19T13:00:00Z"),
                "alpha/staging/x/cover.jpg",
                Map.of("Content-Type", "image/jpeg")
        ));

        mockMvc.perform(post("/api/v1/platform/tenants/42/media/upload-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "filename": "cover.jpg",
                                  "mimeType": "image/jpeg",
                                  "sizeBytes": 1024,
                                  "assetType": "IMAGE",
                                  "intendedVisibility": "PUBLIC",
                                  "scope": "TENANT_PUBLIC"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.assetId").value(55))
                .andExpect(jsonPath("$.data.uploadUrl").exists())
                .andExpect(jsonPath("$.data.headers['Content-Type']").value("image/jpeg"));

        verify(uploadApi).createUploadUrl(any());
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void confirmUploadReturnsReadyAsset() throws Exception {
        MediaAsset asset = readyPublicImage(55L, "alpha");
        when(uploadApi.confirmUpload(any())).thenReturn(new UploadApi.ConfirmUploadResult(
                55L,
                "alpha/public/images/cover.jpg",
                "READY",
                AssetVisibility.PUBLIC,
                1024L,
                "image/jpeg"
        ));
        when(mediaAssetQueryApi.findById(55L)).thenReturn(Optional.of(asset));

        mockMvc.perform(post("/api/v1/platform/tenants/42/media/55/confirm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(55))
                .andExpect(jsonPath("$.data.status").value("READY"))
                .andExpect(jsonPath("$.data.s3Key").value("alpha/public/images/cover.jpg"))
                .andExpect(jsonPath("$.data.cdnUrl")
                        .value("https://cdn.example.test/alpha/public/images/cover.jpg"));

        verify(uploadApi).confirmUpload(any());
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void deleteMediaReturnsQueuedAsset() throws Exception {
        MediaAsset deleted = readyPublicImage(55L, "alpha");
        deleted.setStatus(AssetStatus.PENDING_DELETE);
        when(mediaAssetLifecycleApi.delete(any())).thenReturn(deleted);

        mockMvc.perform(delete("/api/v1/platform/tenants/42/media/55"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(55))
                .andExpect(jsonPath("$.data.status").value("PENDING_DELETE"))
                .andExpect(jsonPath("$.data.cdnUrl").doesNotExist());

        ArgumentCaptor<MediaAssetLifecycleApi.DeleteCommand> commandCaptor =
                ArgumentCaptor.forClass(MediaAssetLifecycleApi.DeleteCommand.class);
        verify(mediaAssetLifecycleApi).delete(commandCaptor.capture());
        MediaAssetLifecycleApi.DeleteCommand command = commandCaptor.getValue();
        assertThat(command.mediaAssetId()).isEqualTo(55L);
        assertThat(command.principal()).isNull();
        assertThat(command.platformOps()).isTrue();
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void deleteMediaRejectsNonPlatformUser() throws Exception {
        mockMvc.perform(delete("/api/v1/platform/tenants/42/media/55"))
                .andExpect(status().isForbidden());
    }

    @Test
    void listMediaRejectsAnonymous() throws Exception {
        mockMvc.perform(get("/api/v1/platform/tenants/42/media"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void listMediaRejectsNonPlatformUser() throws Exception {
        mockMvc.perform(get("/api/v1/platform/tenants/42/media"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void createUploadUrlRejectsNonPlatformUser() throws Exception {
        mockMvc.perform(post("/api/v1/platform/tenants/42/media/upload-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "filename": "cover.jpg",
                                  "mimeType": "image/jpeg",
                                  "sizeBytes": 1024,
                                  "assetType": "IMAGE"
                                }
                                """))
                .andExpect(status().isForbidden());
    }

    private static MediaAsset readyPublicImage(Long id, String slug) {
        Tenant tenant = new Tenant();
        tenant.setId(42L);
        tenant.setSlug(slug);

        MediaAsset asset = new MediaAsset();
        asset.setId(id);
        asset.setTenant(tenant);
        asset.setS3Key(slug + "/public/images/cover.jpg");
        asset.setVisibility(AssetVisibility.PUBLIC);
        asset.setScope(AssetScope.TENANT_PUBLIC);
        asset.setAssetType(AssetType.IMAGE);
        asset.setStatus(AssetStatus.READY);
        asset.setMimeType("image/jpeg");
        asset.setSizeBytes(1024L);
        asset.setOriginalFilename("cover.jpg");
        asset.setCreatedAt(Instant.parse("2026-07-19T12:00:00Z"));
        asset.setUpdatedAt(Instant.parse("2026-07-19T12:00:00Z"));
        return asset;
    }
}
