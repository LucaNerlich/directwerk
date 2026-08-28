package de.pnnit.directwerk.modules.digital.policy;

import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PublicAssetPolicyTest {

    @Test
    void acceptsPublicKeyUnderTenantPrefix() {
        MediaAsset asset = mock(MediaAsset.class);
        when(asset.getVisibility()).thenReturn(AssetVisibility.PUBLIC);
        when(asset.getS3Key()).thenReturn("alpha/public/audio/ep1.mp3");

        assertThat(PublicAssetPolicy.isPublicCdnEligible("alpha", asset)).isTrue();
    }

    @Test
    void rejectsPrivateVisibility() {
        MediaAsset asset = mock(MediaAsset.class);
        when(asset.getVisibility()).thenReturn(AssetVisibility.PRIVATE);
        when(asset.getS3Key()).thenReturn("alpha/public/audio/ep1.mp3");

        assertThat(PublicAssetPolicy.isPublicCdnEligible("alpha", asset)).isFalse();
    }
}
