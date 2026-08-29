package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
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
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
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

    private RemoteAssetIngestService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(10L);
        service = new RemoteAssetIngestService(
                s3Client,
                remoteContentClient,
                mediaAssetRepository,
                tenantRepository,
                directwerkConfig
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
                        URI.create("https://cdn.example.com/ep.mp3"),
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

        MediaAsset ingested = service.ingestFromUrl(new RemoteAssetIngestApi.IngestCommand(
                "https://cdn.example.com/ep.mp3",
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
