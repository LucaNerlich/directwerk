package de.pnnit.directwerk.modules.digital.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.api.CdnPurgeClient;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.modules.queue.JobStatus;
import de.pnnit.directwerk.modules.queue.QueueJob;
import java.net.URL;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(MockitoExtension.class)
class MediaCdnPurgeJobHandlerTest {

    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    @Mock
    private CdnPurgeClient cdnPurgeClient;

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    @Test
    void purgesCdnAndArchivesAsset() throws Exception {
        MediaAsset asset = new MediaAsset();
        asset.setId(55L);
        asset.setStatus(AssetStatus.PENDING_DELETE);
        when(mediaAssetRepository.findById(55L)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MediaCdnPurgeJobHandler handler = new MediaCdnPurgeJobHandler(
                objectMapper,
                cdnPurgeClient,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                mediaAssetRepository
        );
        handler.handle(job(new MediaCdnPurgeJobPayload(
                55L,
                "https://cdn.example.test/alpha/public/images/cover.jpg"
        )));

        ArgumentCaptor<URL> urlCaptor = ArgumentCaptor.forClass(URL.class);
        verify(cdnPurgeClient).purgeUrl(urlCaptor.capture());
        assertThat(urlCaptor.getValue().toString())
                .isEqualTo("https://cdn.example.test/alpha/public/images/cover.jpg");
        assertThat(asset.getStatus()).isEqualTo(AssetStatus.ARCHIVED);
        verify(mediaAssetRepository).saveAndFlush(asset);
    }

    private QueueJob job(MediaCdnPurgeJobPayload payload) {
        Instant now = Instant.now();
        return new QueueJob(
                UUID.randomUUID(),
                MediaJobQueueNames.MEDIA_CDN_PURGE,
                objectMapper.valueToTree(payload),
                0,
                JobStatus.PROCESSING,
                now,
                1,
                8,
                "worker-1",
                now.plusSeconds(60),
                null,
                10L,
                "media-cdn-purge-55",
                null,
                now,
                now
        );
    }
}
