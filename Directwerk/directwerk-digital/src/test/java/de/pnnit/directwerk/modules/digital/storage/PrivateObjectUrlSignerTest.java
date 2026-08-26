package de.pnnit.directwerk.modules.digital.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import java.net.URI;
import java.net.URL;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

/**
 * The one decision tree for private-object delivery: Bunny token auth when fully configured,
 * a clear error when half-configured, S3 presign otherwise. API downloads and RSS delivery
 * must never drift — they share this implementation and this test.
 */
class PrivateObjectUrlSignerTest {

    private final DirectwerkConfig directwerkConfig = mock(DirectwerkConfig.class);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<S3Presigner> presignerProvider = mock(ObjectProvider.class);
    private final S3Presigner presigner = mock(S3Presigner.class);

    private PrivateObjectUrlSigner signer;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws java.net.MalformedURLException {
        signer = new PrivateObjectUrlSigner(directwerkConfig, presignerProvider);
        when(presignerProvider.getIfAvailable()).thenReturn(presigner);
        when(directwerkConfig.storage()).thenReturn(storage(null, null));
        PresignedGetObjectRequest presigned = mock(PresignedGetObjectRequest.class);
        when(presigned.url()).thenReturn(URI.create("https://s3.example.test/signed").toURL());
        when(presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(presigned);
    }

    @Test
    void fallsBackToS3PresignWhenNoPrivateCdnConfigured() {
        URL url = signer.signPrivateObject("alpha/private/audio/ep.mp3", Duration.ofHours(1));

        assertThat(url.toString()).isEqualTo("https://s3.example.test/signed");
        ArgumentCaptor<GetObjectPresignRequest> captor =
                ArgumentCaptor.forClass(GetObjectPresignRequest.class);
        verify(presigner).presignGetObject(captor.capture());
        assertThat(captor.getValue().getObjectRequest().key()).isEqualTo("alpha/private/audio/ep.mp3");
        assertThat(captor.getValue().signatureDuration()).isEqualTo(Duration.ofHours(1));
    }

    @Test
    void signsBunnyTokenUrlWhenBothPropertiesSet() {
        when(directwerkConfig.storage()).thenReturn(storage("https://cdn-private.example.test", "test-key"));

        URL url = signer.signPrivateObject("alpha/private/audio/ep.mp3", Duration.ofHours(24));

        assertThat(url.getHost()).isEqualTo("cdn-private.example.test");
        assertThat(url.getPath()).isEqualTo("/alpha/private/audio/ep.mp3");
        assertThat(url.getQuery()).contains("token=");
        assertThat(url.getQuery()).contains("expires=");
        verify(presignerProvider, org.mockito.Mockito.never()).getIfAvailable();
    }

    @Test
    void rejectsHalfConfiguredPrivateCdn() {
        when(directwerkConfig.storage()).thenReturn(storage("https://cdn-private.example.test", null));

        assertThatThrownBy(() -> signer.signPrivateObject("alpha/private/x.mp3", Duration.ofHours(1)))
                .isInstanceOf(StorageNotConfiguredException.class)
                .hasMessageContaining("private-cdn-base-url");
    }

    @Test
    void ttlIsTheCallersDecisionNotTheSigners() throws Exception {
        // same configuration, two lifetimes — the drift the old duplication allowed
        signer.signPrivateObject("k", Duration.ofHours(1));
        signer.signPrivateObject("k", Duration.ofHours(24));

        ArgumentCaptor<GetObjectPresignRequest> captor =
                ArgumentCaptor.forClass(GetObjectPresignRequest.class);
        verify(presigner, org.mockito.Mockito.times(2)).presignGetObject(captor.capture());
        assertThat(captor.getAllValues().get(0).signatureDuration()).isEqualTo(Duration.ofHours(1));
        assertThat(captor.getAllValues().get(1).signatureDuration()).isEqualTo(Duration.ofHours(24));
    }

    private static DirectwerkProperties.Storage storage(String privateCdnBaseUrl, String tokenKey) {
        return new DirectwerkProperties.Storage(
                true,                    // enabled
                "bunny",                 // provider
                "eu-central",            // region
                "test-bucket",           // bucket
                "public-bucket",         // publicBucket
                "https://s3.example.test", // endpoint
                false,                   // forcePathStyle
                null,                    // accessKey
                null,                    // secretKey
                "https://public.example.test", // publicCdnBaseUrl
                privateCdnBaseUrl,
                tokenKey,
                null,                    // presignUploadTtl
                Duration.ofHours(1),     // presignDownloadTtlApi
                Duration.ofHours(24),    // presignDownloadTtlRss
                24L,                     // stagingLifecycleHours
                3_600_000L,              // stagingCleanupIntervalMs
                null,                    // cdnPurgeApiKey
                null                     // cdnPurgeApiBaseUrl
        );
    }
}
