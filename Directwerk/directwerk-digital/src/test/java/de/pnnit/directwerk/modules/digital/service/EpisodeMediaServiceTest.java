package de.pnnit.directwerk.modules.digital.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.api.CdnPurgeClient;
import de.pnnit.directwerk.modules.digital.api.EpisodeLinkValidator;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EpisodeMediaServiceTest {

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    @Mock
    private ObjectProvider<S3Client> s3ClientProvider;

    @Mock
    private ObjectProvider<S3PublicUrlBuilder> publicUrlBuilderProvider;

    @Mock
    private ObjectProvider<CdnPurgeClient> cdnPurgeClientProvider;

    @Mock
    private ObjectProvider<EpisodeLinkValidator> episodeLinkValidators;

    @Mock
    private PublicCdnUrlResolver publicCdnUrlResolver;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private PlatformTransactionManager transactionManager;

    @Mock
    private S3Client s3Client;

    @Mock
    private ObjectProvider<de.pnnit.directwerk.modules.digital.job.MediaDeleteJobProducer> mediaDeleteJobProducerProvider;

    @Mock
    private de.pnnit.directwerk.modules.digital.job.MediaDeleteJobProducer mediaDeleteJobProducer;

    private EpisodeMediaService service;
    private Tenant tenant;

    @BeforeEach
    void setUp() {
        service = new EpisodeMediaService(
                mediaAssetRepository,
                s3ClientProvider,
                publicUrlBuilderProvider,
                cdnPurgeClientProvider,
                publicCdnUrlResolver,
                directwerkConfig,
                transactionManager,
                episodeLinkValidators,
                mediaDeleteJobProducerProvider);
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
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
    void attachEpisodeRejectsAnAssetLinkedToAnotherEpisode() {
        MediaAsset asset = readyAudio(77L);
        asset.setEpisodeId(5L);
        when(mediaAssetRepository.findByIdForUpdate(77L)).thenReturn(Optional.of(asset));
        when(episodeLinkValidators.getIfAvailable()).thenReturn((tenantId, episodeId) -> true);

        assertThatThrownBy(() -> service.attachEpisode(77L, 6L))
                .isInstanceOf(de.pnnit.directwerk.modules.digital.exception.UploadValidationException.class)
                .hasMessageContaining("already attached");
    }

    @Test
    void attachEpisodeAllowsReLinkingWhenTheOldEpisodeNoLongerReferencesTheAsset() {
        MediaAsset asset = readyAudio(77L);
        asset.setEpisodeId(5L);
        when(mediaAssetRepository.findByIdForUpdate(77L)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.save(any(MediaAsset.class))).thenAnswer(inv -> inv.getArgument(0));
        EpisodeLinkValidator validator = new EpisodeLinkValidator() {
            @Override
            public boolean episodeExists(Long tenantId, Long episodeId) {
                return true;
            }

            @Override
            public boolean episodeReferencesAudioAsset(Long tenantId, Long episodeId, Long audioAssetId) {
                return false;
            }
        };
        when(episodeLinkValidators.getIfAvailable()).thenReturn(validator);

        service.attachEpisode(77L, 6L);

        assertThat(asset.getEpisodeId()).isEqualTo(6L);
    }

    @Test
    void attachEpisodeClearsThePreviousAssetOfTheEpisode() {
        MediaAsset asset = readyAudio(77L);
        when(mediaAssetRepository.findByIdForUpdate(77L)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.save(any(MediaAsset.class))).thenAnswer(inv -> inv.getArgument(0));
        when(episodeLinkValidators.getIfAvailable()).thenReturn((tenantId, episodeId) -> true);

        service.attachEpisode(77L, 6L);

        verify(mediaAssetRepository).clearOtherEpisodeLinks(10L, 6L, 77L);
        assertThat(asset.getEpisodeId()).isEqualTo(6L);
    }

    private MediaAsset readyAudio(Long id) {
        MediaAsset asset = new MediaAsset();
        asset.setId(id);
        asset.setTenant(tenant);
        asset.setAssetType(AssetType.AUDIO);
        asset.setStatus(AssetStatus.READY);
        return asset;
    }

    @Test
    void demoteToPrivateEnqueuesCleanupWhenThePublicObjectDeleteFails() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(s3ClientProvider.getIfAvailable()).thenReturn(s3Client);
        when(mediaDeleteJobProducerProvider.getIfAvailable()).thenReturn(mediaDeleteJobProducer);

        MediaAsset asset = readyAudio(77L);
        asset.setS3Key("alpha-show-a/public/audio/asset-77_ep.mp3");
        asset.setVisibility(AssetVisibility.PUBLIC);
        asset.setScope(AssetScope.TENANT_PUBLIC);
        when(mediaAssetRepository.findById(77L)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.save(any(MediaAsset.class))).thenAnswer(inv -> inv.getArgument(0));
        when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenThrow(software.amazon.awssdk.services.s3.model.S3Exception.builder().message("boom").build());

        service.demoteToPrivate(77L);

        verify(mediaDeleteJobProducer).enqueueS3Delete(
                org.mockito.ArgumentMatchers.eq(77L),
                org.mockito.ArgumentMatchers.eq("alpha-show-a/public/audio/asset-77_ep.mp3"),
                org.mockito.ArgumentMatchers.isNull()
        );
    }

    @Test
    void promoteToPublicDeletesStalePrivateObjectAfterCommit() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storageProps());
        when(s3ClientProvider.getIfAvailable()).thenReturn(s3Client);

        MediaAsset asset = new MediaAsset();
        asset.setId(77L);
        asset.setTenant(tenant);
        asset.setS3Key("alpha-show-a/private/audio/asset-77_ep.mp3");
        asset.setVisibility(AssetVisibility.PRIVATE);
        asset.setScope(AssetScope.CONTENT);
        asset.setAssetType(AssetType.AUDIO);
        asset.setStatus(AssetStatus.READY);
        when(mediaAssetRepository.findById(77L)).thenReturn(Optional.of(asset));
        when(mediaAssetRepository.save(any(MediaAsset.class))).thenAnswer(inv -> inv.getArgument(0));

        MediaAsset result = service.promoteToPublic(77L);

        assertThat(result.getVisibility()).isEqualTo(AssetVisibility.PUBLIC);
        assertThat(result.getS3Key()).isEqualTo("alpha-show-a/public/audio/asset-77_ep.mp3");
        verify(s3Client).copyObject(any(CopyObjectRequest.class));

        // Issue #305: the private object the asset no longer references is deleted post-commit.
        ArgumentCaptor<DeleteObjectRequest> deleted = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client).deleteObject(deleted.capture());
        assertThat(deleted.getValue().key()).isEqualTo("alpha-show-a/private/audio/asset-77_ep.mp3");
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
                null,
                null);
    }
}
