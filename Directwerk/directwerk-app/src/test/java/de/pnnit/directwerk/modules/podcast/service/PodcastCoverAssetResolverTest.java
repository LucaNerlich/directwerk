package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class PodcastCoverAssetResolverTest {

    private final MediaAssetRepository repository = mock(MediaAssetRepository.class);
    private final PodcastCoverAssetResolver resolver = new PodcastCoverAssetResolver(repository);

    @Test
    void rejectsAPrivateImageThatCouldNeverRenderInTheFeed() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        MediaAsset asset = new MediaAsset();
        asset.setId(9L);
        asset.setTenant(tenant);
        asset.setStatus(AssetStatus.READY);
        asset.setAssetType(AssetType.IMAGE);
        asset.setVisibility(AssetVisibility.PRIVATE);
        when(repository.findById(9L)).thenReturn(Optional.of(asset));

        assertThatThrownBy(() -> resolver.resolveCoverAsset(1L, 9L))
                .isInstanceOf(UploadValidationException.class)
                .hasMessageContaining("PUBLIC");
    }
}
