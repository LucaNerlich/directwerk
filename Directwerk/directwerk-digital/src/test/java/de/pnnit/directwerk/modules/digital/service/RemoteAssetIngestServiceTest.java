package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.api.RemoteAssetIngestApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.net.RemoteContentClient;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.AbortMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@ExtendWith(MockitoExtension.class)
class RemoteAssetIngestServiceTest {

    @Mock
    private S3Client s3Client;
    @Mock
    private RemoteContentClient remoteContentClient;
    @Mock
    private MediaAssetRepository mediaAssetRepository;
    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private DirectwerkConfig directwerkConfig;
    @Mock
    private PlatformTransactionManager transactionManager;

    private RemoteAssetIngestService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(10L);
        lenient().when(transactionManager.getTransaction(any())).thenReturn(org.mockito.Mockito.mock(TransactionStatus.class));
        service = new RemoteAssetIngestService(
                s3Client,
                remoteContentClient,
                mediaAssetRepository,
                tenantRepository,
                directwerkConfig,
                transactionManager
        );
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void streamsKnownLengthBodyToS3WithoutBufferingWholeFile() throws Exception {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        when(tenantRepository.requireById(10L)).thenReturn(tenant);
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storage());

        byte[] body = "id3-fake-mp3".getBytes(StandardCharsets.UTF_8);
        when(remoteContentClient.get(any(URI.class), any(Duration.class))).thenReturn(
                new RemoteContentClient.RemoteResponse(
                        URI.create("https://1.1.1.1/ep.mp3"),
                        200,
                        "audio/mpeg",
                        (long) body.length,
                        new ByteArrayInputStream(body)
                )
        );
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> {
            MediaAsset asset = invocation.getArgument(0);
            if (asset.getId() == null) {
                asset.setId(42L);
            }
            return asset;
        });
        doAnswer(invocation -> {
            RequestBody requestBody = invocation.getArgument(1);
            try (InputStream uploaded = requestBody.contentStreamProvider().newStream()) {
                uploaded.transferTo(OutputStream.nullOutputStream());
            }
            return null;
        }).when(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));

        MediaAsset ingested = service.ingestFromUrl(new RemoteAssetIngestApi.IngestCommand(
                "https://1.1.1.1/ep.mp3",
                AssetType.AUDIO,
                AssetVisibility.PRIVATE,
                null
        ));

        assertThat(ingested.getStatus()).isEqualTo(AssetStatus.READY);
        assertThat(ingested.getS3Key()).startsWith("alpha/private/audio/asset-42_");
        assertThat(ingested.getSizeBytes()).isEqualTo(body.length);
        ArgumentCaptor<PutObjectRequest> put = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(put.capture(), any(RequestBody.class));
        assertThat(put.getValue().contentLength()).isEqualTo((long) body.length);
        assertThat(put.getValue().contentType()).isEqualTo("audio/mpeg");
    }

    @Test
    void discardsUnattachedIngestedAssetFromDatabaseAndS3() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        MediaAsset asset = new MediaAsset();
        asset.setId(42L);
        asset.setTenant(tenant);
        asset.setS3Key("alpha/private/audio/asset-42_episode.mp3");
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storage());
        when(mediaAssetRepository.findById(42L)).thenReturn(java.util.Optional.of(asset));

        service.discard(42L);

        verify(mediaAssetRepository).delete(asset);
        verify(s3Client).deleteObject(any(software.amazon.awssdk.services.s3.model.DeleteObjectRequest.class));
    }

    @Test
    void removesPendingAssetWhenUnknownLengthStreamFails() throws Exception {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        when(tenantRepository.requireById(10L)).thenReturn(tenant);
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storage());
        InputStream broken = new InputStream() {
            @Override
            public int read() throws IOException {
                throw new IOException("upstream disconnected");
            }
        };
        when(remoteContentClient.get(any(URI.class), any(Duration.class))).thenReturn(
                new RemoteContentClient.RemoteResponse(
                        URI.create("https://1.1.1.1/ep.mp3"),
                        200,
                        "audio/mpeg",
                        null,
                        broken
                )
        );
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> {
            MediaAsset asset = invocation.getArgument(0);
            asset.setId(42L);
            return asset;
        });
        when(s3Client.createMultipartUpload(any(CreateMultipartUploadRequest.class))).thenReturn(
                CreateMultipartUploadResponse.builder().uploadId("upload-1").build()
        );

        assertThatThrownBy(() -> service.ingestFromUrl(new RemoteAssetIngestApi.IngestCommand(
                "https://1.1.1.1/ep.mp3",
                AssetType.AUDIO,
                AssetVisibility.PRIVATE,
                null
        ))).isInstanceOf(de.pnnit.directwerk.modules.digital.exception.UploadValidationException.class);

        verify(s3Client).abortMultipartUpload(any(AbortMultipartUploadRequest.class));
        verify(mediaAssetRepository).delete(any(MediaAsset.class));
    }

    private static DirectwerkProperties.Storage storage() {
        return new DirectwerkProperties.Storage(
                true,
                "hetzner",
                "nbg1",
                "directwerk-dev",
                null,
                "https://s3.example.com",
                true,
                "key",
                "secret",
                null,
                null,
                null,
                Duration.ofMinutes(15),
                Duration.ofHours(1),
                Duration.ofHours(24),
                24,
                3_600_000,
                null,
                null
        );
    }
}
