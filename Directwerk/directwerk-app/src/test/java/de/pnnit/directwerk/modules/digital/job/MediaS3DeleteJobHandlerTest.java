package de.pnnit.directwerk.modules.digital.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.queue.QueueJob;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(MockitoExtension.class)
class MediaS3DeleteJobHandlerTest {

    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    @Mock
    private S3Client s3Client;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    @Mock
    private MediaDeleteJobProducer mediaDeleteJobProducer;

    @Test
    void deletesS3AndEnqueuesCdnPurgeWhenUrlPresent() {
        MediaAsset asset = pendingDeleteAsset(55L);
        asset.setS3Key("alpha/public/images/cover.jpg");
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(mediaAssetRepository.findById(55L)).thenReturn(Optional.of(asset));

        MediaS3DeleteJobHandler handler = new MediaS3DeleteJobHandler(
                objectMapper,
                s3Client,
                directwerkConfig,
                mediaAssetRepository,
                mediaDeleteJobProducer
        );
        handler.handle(job(new MediaS3DeleteJobPayload(
                55L,
                "alpha/public/images/cover.jpg",
                "https://cdn.example.test/alpha/public/images/cover.jpg"
        )));

        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));
        verify(mediaDeleteJobProducer).enqueueCdnPurge(
                eq(55L),
                eq("https://cdn.example.test/alpha/public/images/cover.jpg")
        );
        verify(mediaAssetRepository, never()).saveAndFlush(any());
        assertThat(asset.getStatus()).isEqualTo(AssetStatus.PENDING_DELETE);
    }

    @Test
    void skipsADeleteWhenTheJobTenantDoesNotOwnTheAsset() {
        MediaAsset asset = pendingDeleteAsset(55L);
        asset.getTenant().setId(11L);
        when(mediaAssetRepository.findById(55L)).thenReturn(Optional.of(asset));

        MediaS3DeleteJobHandler handler = new MediaS3DeleteJobHandler(
                objectMapper,
                s3Client,
                directwerkConfig,
                mediaAssetRepository,
                mediaDeleteJobProducer
        );
        handler.handle(job(new MediaS3DeleteJobPayload(55L, "alpha/key", null)));

        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
        verify(mediaAssetRepository, never()).saveAndFlush(any());
        assertThat(asset.getStatus()).isEqualTo(AssetStatus.PENDING_DELETE);
    }

    @Test
    void skipsADeleteWhenTheKeyBelongsToAnotherTenant() {
        MediaAsset asset = pendingDeleteAsset(55L);
        when(mediaAssetRepository.findById(55L)).thenReturn(Optional.of(asset));

        MediaS3DeleteJobHandler handler = new MediaS3DeleteJobHandler(
                objectMapper,
                s3Client,
                directwerkConfig,
                mediaAssetRepository,
                mediaDeleteJobProducer
        );
        handler.handle(job(new MediaS3DeleteJobPayload(55L, "beta/key", null)));

        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
        verify(mediaAssetRepository, never()).saveAndFlush(any());
    }

    @Test
    void archivesImmediatelyWhenNoCdnPurgeNeeded() {
        MediaAsset asset = pendingDeleteAsset(70L);
        asset.setS3Key("alpha/private/audio/ep.mp3");
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(mediaAssetRepository.findById(70L)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MediaS3DeleteJobHandler handler = new MediaS3DeleteJobHandler(
                objectMapper,
                s3Client,
                directwerkConfig,
                mediaAssetRepository,
                mediaDeleteJobProducer
        );
        handler.handle(job(new MediaS3DeleteJobPayload(70L, "alpha/private/audio/ep.mp3", null)));

        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));
        verify(mediaDeleteJobProducer, never()).enqueueCdnPurge(any(), any());
        ArgumentCaptor<MediaAsset> captor = ArgumentCaptor.forClass(MediaAsset.class);
        verify(mediaAssetRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(AssetStatus.ARCHIVED);
    }

    @Test
    void deletesAStalePublicKeyWithoutArchivingTheDemotedAsset() {
        MediaAsset asset = pendingDeleteAsset(80L);
        asset.setStatus(AssetStatus.READY);
        asset.setS3Key("alpha/private/audio/ep.mp3");
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(mediaAssetRepository.findById(80L)).thenReturn(Optional.of(asset));

        MediaS3DeleteJobHandler handler = new MediaS3DeleteJobHandler(
                objectMapper,
                s3Client,
                directwerkConfig,
                mediaAssetRepository,
                mediaDeleteJobProducer
        );
        handler.handle(job(new MediaS3DeleteJobPayload(
                80L,
                "alpha/public/audio/ep.mp3",
                "https://cdn.example.test/alpha/public/audio/ep.mp3"
        )));

        ArgumentCaptor<DeleteObjectRequest> deleted = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client).deleteObject(deleted.capture());
        assertThat(deleted.getValue().key()).isEqualTo("alpha/public/audio/ep.mp3");
        verify(mediaDeleteJobProducer).enqueueCdnPurge(80L, "https://cdn.example.test/alpha/public/audio/ep.mp3");
        verify(mediaAssetRepository, never()).hasAttachedReferences(any());
        verify(mediaAssetRepository, never()).saveAndFlush(any());
        assertThat(asset.getStatus()).isEqualTo(AssetStatus.READY);
    }

    private QueueJob job(MediaS3DeleteJobPayload payload) {
        Instant now = Instant.now();
        return new QueueJob(
                UUID.randomUUID(),
                MediaJobQueueNames.MEDIA_S3_DELETE,
                objectMapper.valueToTree(payload),
                0,
                de.pnnit.directwerk.modules.queue.JobStatus.PROCESSING,
                now,
                1,
                8,
                "worker-1",
                now.plusSeconds(60),
                null,
                10L,
                "media-s3-delete-55",
                null,
                now,
                now
        );
    }

    private static MediaAsset pendingDeleteAsset(Long id) {
        MediaAsset asset = new MediaAsset();
        asset.setId(id);
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        asset.setTenant(tenant);
        asset.setStatus(AssetStatus.PENDING_DELETE);
        asset.setS3Key("alpha/key");
        return asset;
    }

    private static DirectwerkProperties.Storage storageProps() {
        return new DirectwerkProperties.Storage(
                true,
                "bunny",
                "de",
                "directwerk-dev",
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
                "purge-key",
                "https://api.bunny.net"
        );
    }
}
