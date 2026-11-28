package de.pnnit.directwerk.modules.digital.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
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

    @Mock
    private de.pnnit.directwerk.modules.core.repository.TenantRepository tenantRepository;

    @Test
    void purgesCdnAndArchivesAsset() throws Exception {
        MediaAsset asset = new MediaAsset();
        asset.setId(55L);
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        asset.setTenant(tenant);
        asset.setStatus(AssetStatus.PENDING_DELETE);
        when(mediaAssetRepository.findById(55L)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MediaCdnPurgeJobHandler handler = new MediaCdnPurgeJobHandler(
                objectMapper,
                cdnPurgeClient,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                mediaAssetRepository,
                tenantRepository
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

    @Test
    void purgesCdnWithoutArchivingAStillLiveAsset() throws Exception {
        MediaAsset asset = new MediaAsset();
        asset.setId(56L);
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        asset.setTenant(tenant);
        asset.setStatus(AssetStatus.READY);
        when(mediaAssetRepository.findById(56L)).thenReturn(Optional.of(asset));

        MediaCdnPurgeJobHandler handler = new MediaCdnPurgeJobHandler(
                objectMapper,
                cdnPurgeClient,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                mediaAssetRepository,
                tenantRepository
        );
        handler.handle(job(new MediaCdnPurgeJobPayload(
                56L,
                "https://cdn.example.test/alpha/public/audio/stale.mp3"
        )));

        verify(cdnPurgeClient).purgeUrl(any(URL.class));
        assertThat(asset.getStatus()).isEqualTo(AssetStatus.READY);
        verify(mediaAssetRepository, never()).saveAndFlush(any(MediaAsset.class));
    }

    @Test
    void skipsAnotherTenantsCdnUrlBeforePurging() throws Exception {
        MediaAsset asset = new MediaAsset();
        asset.setId(57L);
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        asset.setTenant(tenant);
        asset.setStatus(AssetStatus.PENDING_DELETE);
        when(mediaAssetRepository.findById(57L)).thenReturn(Optional.of(asset));

        MediaCdnPurgeJobHandler handler = new MediaCdnPurgeJobHandler(
                objectMapper,
                cdnPurgeClient,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                mediaAssetRepository,
                tenantRepository
        );
        handler.handle(job(new MediaCdnPurgeJobPayload(
                57L,
                "https://cdn.example.test/beta/public/images/other.jpg"
        )));

        verify(cdnPurgeClient, never()).purgeUrl(any(URL.class));
        assertThat(asset.getStatus()).isEqualTo(AssetStatus.PENDING_DELETE);
        verify(mediaAssetRepository, never()).saveAndFlush(any(MediaAsset.class));
    }

    @Test
    void skipsAPurgeForAMissingAssetWhenTheUrlBelongsToAnotherTenant() throws Exception {
        when(mediaAssetRepository.findById(58L)).thenReturn(Optional.empty());
        de.pnnit.directwerk.modules.core.entity.Tenant tenant =
                new de.pnnit.directwerk.modules.core.entity.Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");
        when(tenantRepository.requireById(10L)).thenReturn(tenant);

        MediaCdnPurgeJobHandler handler = new MediaCdnPurgeJobHandler(
                objectMapper,
                cdnPurgeClient,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                mediaAssetRepository,
                tenantRepository
        );
        handler.handle(job(new MediaCdnPurgeJobPayload(
                58L,
                "https://cdn.example.test/beta/public/images/other.jpg"
        )));

        verify(cdnPurgeClient, never()).purgeUrl(any(URL.class));
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
