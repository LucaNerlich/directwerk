package de.pnnit.directwerk.modules.digital.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.S3Object;

@ExtendWith(MockitoExtension.class)
class StagingCleanupServiceTest {

    @Mock
    private S3Client s3Client;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    @Mock
    private PlatformTransactionManager transactionManager;

    @Mock
    private TransactionStatus transactionStatus;

    private StagingCleanupService stagingCleanupService;
    private Tenant tenant;

    @BeforeEach
    void setUp() {
        stagingCleanupService = new StagingCleanupService(
                s3Client,
                directwerkConfig,
                tenantRepository,
                mediaAssetRepository,
                transactionManager
        );
        lenient().when(transactionManager.getTransaction(any())).thenReturn(transactionStatus);
        tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha-show-a");
    }

    @AfterEach
    void clear() {
        TenantContext.clear();
    }

    @Test
    void deleteStagingKeyAndFolderDeletesFileAndFolderMarkers() {
        stagingCleanupService.deleteStagingKeyAndFolder(
                "directwerk-dev",
                "alpha-show-a/staging/sess/recording.mp3"
        );

        ArgumentCaptor<DeleteObjectRequest> captor = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client, times(3)).deleteObject(captor.capture());
        List<String> keys = captor.getAllValues().stream().map(DeleteObjectRequest::key).toList();
        assertThat(keys)
                .containsExactlyInAnyOrder(
                        "alpha-show-a/staging/sess/recording.mp3",
                        "alpha-show-a/staging/sess/",
                        "alpha-show-a/staging/sess"
                );
    }

    @Test
    void deleteStagingKeyAndFolderRejectsNonStagingKey() {
        assertThatThrownBy(() -> stagingCleanupService.deleteStagingKeyAndFolder(
                "directwerk-dev",
                "alpha-show-a/private/audio/x.mp3"
        )).isInstanceOf(IllegalArgumentException.class);
        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    void deleteStagingKeyAndFolderIsIdempotentWhenObjectsMissing() {
        when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenThrow(NoSuchKeyException.builder().message("gone").build());

        stagingCleanupService.deleteStagingKeyAndFolder(
                "directwerk-dev",
                "alpha-show-a/staging/sess/recording.mp3"
        );

        verify(s3Client, times(3)).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    void deleteStagingKeyAndFolderIgnoresHttp404() {
        when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenThrow(S3Exception.builder().statusCode(404).message("not found").build());

        stagingCleanupService.deleteStagingKeyAndFolder(
                "directwerk-dev",
                "alpha-show-a/staging/sess/recording.mp3"
        );

        verify(s3Client, times(3)).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    void cleanupExpiredStagingDeletesExpiredObjectsAndArchivesPendingAssets() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantRepository.findAll()).thenReturn(List.of(tenant));

        Instant old = Instant.now().minus(48, ChronoUnit.HOURS);
        Instant fresh = Instant.now().minus(1, ChronoUnit.HOURS);
        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(
                ListObjectsV2Response.builder()
                        .isTruncated(false)
                        .contents(
                                S3Object.builder().key("alpha-show-a/staging/sess/expired.mp3").lastModified(old).build(),
                                S3Object.builder().key("alpha-show-a/staging/sess/fresh.mp3").lastModified(fresh).build(),
                                S3Object.builder().key("alpha-show-a/staging/sess/").lastModified(old).build()
                        )
                        .build()
        );

        stagingCleanupService.cleanupExpiredStaging();

        ArgumentCaptor<DeleteObjectRequest> captor = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client, times(2)).deleteObject(captor.capture());
        List<String> keys = captor.getAllValues().stream().map(DeleteObjectRequest::key).toList();
        assertThat(keys)
                .containsExactlyInAnyOrder(
                        "alpha-show-a/staging/sess/expired.mp3",
                        "alpha-show-a/staging/sess/"
                );
        verify(mediaAssetRepository).archivePendingByS3Key(10L, "alpha-show-a/staging/sess/expired.mp3");
        verify(mediaAssetRepository, never()).archivePendingByS3Key(10L, "alpha-show-a/staging/sess/fresh.mp3");
        verify(mediaAssetRepository, never()).archivePendingByS3Key(10L, "alpha-show-a/staging/sess/");
    }

    @Test
    void cleanupExpiredStagingPaginatesTruncatedListings() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantRepository.findAll()).thenReturn(List.of(tenant));

        Instant old = Instant.now().minus(48, ChronoUnit.HOURS);
        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(
                ListObjectsV2Response.builder()
                        .isTruncated(true)
                        .nextContinuationToken("token-1")
                        .contents(S3Object.builder().key("alpha-show-a/staging/sess/page1.mp3").lastModified(old).build())
                        .build(),
                ListObjectsV2Response.builder()
                        .isTruncated(false)
                        .contents(S3Object.builder().key("alpha-show-a/staging/sess/page2.mp3").lastModified(old).build())
                        .build()
        );

        stagingCleanupService.cleanupExpiredStaging();

        ArgumentCaptor<ListObjectsV2Request> captor = ArgumentCaptor.forClass(ListObjectsV2Request.class);
        verify(s3Client, times(2)).listObjectsV2(captor.capture());
        assertThat(captor.getAllValues().get(1).continuationToken()).isEqualTo("token-1");
        verify(mediaAssetRepository).archivePendingByS3Key(10L, "alpha-show-a/staging/sess/page1.mp3");
        verify(mediaAssetRepository).archivePendingByS3Key(10L, "alpha-show-a/staging/sess/page2.mp3");
    }

    @Test
    void cleanupExpiredStagingArchivesEachPageBeforeTheNextListCall() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(tenantRepository.findAll()).thenReturn(List.of(tenant));

        Instant old = Instant.now().minus(48, ChronoUnit.HOURS);
        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class)))
                .thenReturn(
                        ListObjectsV2Response.builder()
                                .isTruncated(true)
                                .nextContinuationToken("token-1")
                                .contents(S3Object.builder().key("alpha-show-a/staging/sess/page1.mp3").lastModified(old).build())
                                .build())
                .thenThrow(S3Exception.builder().statusCode(503).message("unavailable").build());

        stagingCleanupService.cleanupExpiredStaging();

        verify(mediaAssetRepository).archivePendingByS3Key(10L, "alpha-show-a/staging/sess/page1.mp3");
        verify(s3Client, times(2)).listObjectsV2(any(ListObjectsV2Request.class));
    }

    @Test
    void cleanupExpiredStagingContinuesAfterTenantFailure() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());

        Tenant broken = new Tenant();
        broken.setId(1L);
        broken.setSlug("broken-tenant");
        when(tenantRepository.findAll()).thenReturn(List.of(broken, tenant));

        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class)))
                .thenThrow(S3Exception.builder().statusCode(503).message("unavailable").build());

        stagingCleanupService.cleanupExpiredStaging();

        ArgumentCaptor<ListObjectsV2Request> captor = ArgumentCaptor.forClass(ListObjectsV2Request.class);
        verify(s3Client, times(2)).listObjectsV2(captor.capture());
        List<String> prefixes = captor.getAllValues().stream().map(ListObjectsV2Request::prefix).toList();
        assertThat(prefixes).containsExactlyInAnyOrder("broken-tenant/staging/", "alpha-show-a/staging/");
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
