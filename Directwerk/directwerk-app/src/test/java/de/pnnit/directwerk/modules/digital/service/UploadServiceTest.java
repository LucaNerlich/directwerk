package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.api.UploadApi;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.digital.job.MediaDeleteJobProducer;
import de.pnnit.directwerk.modules.digital.job.StagingCleanupService;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.net.URI;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@ExtendWith(MockitoExtension.class)
class UploadServiceTest {

    @Mock
    private S3Client s3Client;

    @Mock
    private S3Presigner s3Presigner;

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private StagingCleanupService stagingCleanupService;

    @Mock
    private MediaDeleteJobProducer mediaDeleteJobProducer;

    @Mock
    private PlatformTransactionManager transactionManager;

    @Mock
    private PresignedPutObjectRequest presignedPut;

    private UploadService uploadService;
    private Tenant tenant;

    @BeforeEach
    void setUp() {
        uploadService = new UploadService(
                s3Client,
                s3Presigner,
                mediaAssetRepository,
                tenantRepository,
                directwerkConfig,
                stagingCleanupService,
                mediaDeleteJobProducer,
                transactionManager
        );
        lenient().when(transactionManager.getTransaction(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new SimpleTransactionStatus());
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
    void createUploadUrlPersistsPendingAssetAndReturnsPresignedPut() throws Exception {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantRepository.requireById(10L)).thenReturn(tenant);
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> {
            MediaAsset asset = invocation.getArgument(0);
            asset.setId(1001L);
            return asset;
        });
        when(presignedPut.url()).thenReturn(URI.create("https://s3.example/put").toURL());
        when(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).thenReturn(presignedPut);

        UploadApi.UploadUrlResult result = uploadService.createUploadUrl(new UploadApi.CreateUploadUrlCommand(
                "episode.mp3",
                "audio/mp3; charset=binary",
                2048,
                AssetType.AUDIO,
                AssetVisibility.PRIVATE,
                AssetScope.CONTENT,
                null,
                null
        ));

        assertThat(result.assetId()).isEqualTo(1001L);
        assertThat(result.uploadUrl()).isEqualTo("https://s3.example/put");
        assertThat(result.stagingKey()).startsWith("alpha-show-a/staging/");
        assertThat(result.headers()).containsEntry("Content-Type", "audio/mpeg");

        ArgumentCaptor<PutObjectPresignRequest> presignCaptor =
                ArgumentCaptor.forClass(PutObjectPresignRequest.class);
        verify(s3Presigner).presignPutObject(presignCaptor.capture());
        var putObjectRequest = presignCaptor.getValue().putObjectRequest();
        assertThat(putObjectRequest.contentLength()).isNull();
        assertThat(putObjectRequest.contentType()).isEqualTo("audio/mpeg");
        assertThat(putObjectRequest.bucket()).isEqualTo("directwerk-dev");
        assertThat(putObjectRequest.key()).startsWith("alpha-show-a/staging/");

        ArgumentCaptor<MediaAsset> assetCaptor = ArgumentCaptor.forClass(MediaAsset.class);
        verify(mediaAssetRepository).saveAndFlush(assetCaptor.capture());
        assertThat(assetCaptor.getValue().getStatus()).isEqualTo(AssetStatus.PENDING);
        assertThat(assetCaptor.getValue().getMimeType()).isEqualTo("audio/mpeg");
    }

    @Test
    void createUploadUrlRejectsInvalidMime() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantRepository.requireById(10L)).thenReturn(tenant);

        assertThatThrownBy(() -> uploadService.createUploadUrl(new UploadApi.CreateUploadUrlCommand(
                "x.exe",
                "application/octet-stream",
                100,
                AssetType.AUDIO,
                AssetVisibility.PRIVATE,
                AssetScope.CONTENT,
                null,
                null
        ))).isInstanceOf(UploadValidationException.class);
    }

    @Test
    void confirmUploadPromotesStagingObject() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantRepository.requireById(10L)).thenReturn(tenant);

        MediaAsset pending = new MediaAsset();
        pending.setId(55L);
        pending.setTenant(tenant);
        pending.setS3Key("alpha-show-a/staging/sess/episode.mp3");
        pending.setVisibility(AssetVisibility.PRIVATE);
        pending.setScope(AssetScope.CONTENT);
        pending.setAssetType(AssetType.AUDIO);
        pending.setStatus(AssetStatus.PENDING);
        pending.setMimeType("audio/mpeg");
        pending.setSizeBytes(2048L);
        pending.setOriginalFilename("episode.mp3");
        when(mediaAssetRepository.findById(55L)).thenReturn(Optional.of(pending));
        when(mediaAssetRepository.findByIdForUpdate(55L)).thenReturn(Optional.of(pending));
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(inv -> inv.getArgument(0));
        when(s3Client.headObject(any(HeadObjectRequest.class))).thenReturn(
                HeadObjectResponse.builder()
                        .contentLength(2048L)
                        .contentType("audio/mpeg")
                        .eTag("\"abc\"")
                        .build()
        );

        UploadApi.ConfirmUploadResult result = uploadService.confirmUpload(new UploadApi.ConfirmUploadCommand(55L));

        assertThat(result.status()).isEqualTo("READY");
        assertThat(result.s3Key()).startsWith("alpha-show-a/private/audio/");
        assertThat(result.s3Key()).matches(
                "alpha-show-a/private/audio/asset-\\d+_episode\\.mp3"
        );
        verify(s3Client).copyObject(any(CopyObjectRequest.class));
        verify(stagingCleanupService).deleteStagingKeyAndFolder(
                "directwerk-dev",
                "alpha-show-a/staging/sess/episode.mp3"
        );
        verify(mediaDeleteJobProducer, never()).enqueueStagingCleanup(any());
    }

    @Test
    void confirmUploadAppendsSanitizedFilenameStem() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantRepository.requireById(10L)).thenReturn(tenant);

        MediaAsset pending = new MediaAsset();
        pending.setId(55L);
        pending.setTenant(tenant);
        pending.setS3Key("alpha-show-a/staging/sess/episode_42.mp3");
        pending.setVisibility(AssetVisibility.PRIVATE);
        pending.setScope(AssetScope.CONTENT);
        pending.setAssetType(AssetType.AUDIO);
        pending.setStatus(AssetStatus.PENDING);
        pending.setMimeType("audio/mpeg");
        pending.setSizeBytes(2048L);
        pending.setOriginalFilename("episode 42.mp3");
        when(mediaAssetRepository.findById(55L)).thenReturn(Optional.of(pending));
        when(mediaAssetRepository.findByIdForUpdate(55L)).thenReturn(Optional.of(pending));
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(inv -> inv.getArgument(0));
        when(s3Client.headObject(any(HeadObjectRequest.class))).thenReturn(
                HeadObjectResponse.builder()
                        .contentLength(2048L)
                        .contentType("audio/mpeg")
                        .eTag("\"abc\"")
                        .build()
        );

        UploadApi.ConfirmUploadResult result = uploadService.confirmUpload(new UploadApi.ConfirmUploadCommand(55L));

        assertThat(result.status()).isEqualTo("READY");
        assertThat(result.s3Key()).matches(
                "alpha-show-a/private/audio/asset-\\d+_episode_42\\.mp3"
        );
    }

    @Test
    void confirmUploadEnqueuesCleanupWhenS3DeleteFails() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantRepository.requireById(10L)).thenReturn(tenant);

        MediaAsset pending = new MediaAsset();
        pending.setId(55L);
        pending.setTenant(tenant);
        pending.setS3Key("alpha-show-a/staging/sess/episode.mp3");
        pending.setVisibility(AssetVisibility.PRIVATE);
        pending.setScope(AssetScope.CONTENT);
        pending.setAssetType(AssetType.AUDIO);
        pending.setStatus(AssetStatus.PENDING);
        pending.setMimeType("audio/mpeg");
        pending.setSizeBytes(2048L);
        pending.setOriginalFilename("episode.mp3");
        when(mediaAssetRepository.findById(55L)).thenReturn(Optional.of(pending));
        when(mediaAssetRepository.findByIdForUpdate(55L)).thenReturn(Optional.of(pending));
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(inv -> inv.getArgument(0));
        when(s3Client.headObject(any(HeadObjectRequest.class))).thenReturn(
                HeadObjectResponse.builder()
                        .contentLength(2048L)
                        .contentType("audio/mpeg")
                        .eTag("\"abc\"")
                        .build()
        );
        S3Exception s3Unavailable = (S3Exception) S3Exception.builder()
                .statusCode(503)
                .message("Service Unavailable")
                .build();
        org.mockito.Mockito.doThrow(s3Unavailable)
                .when(stagingCleanupService)
                .deleteStagingKeyAndFolder("directwerk-dev", "alpha-show-a/staging/sess/episode.mp3");

        UploadApi.ConfirmUploadResult result = uploadService.confirmUpload(new UploadApi.ConfirmUploadCommand(55L));

        assertThat(result.status()).isEqualTo("READY");
        verify(mediaDeleteJobProducer).enqueueStagingCleanup("alpha-show-a/staging/sess/episode.mp3");
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
                3600000L,
                null,
                null
        );
    }
}
