package de.pnnit.directwerk.modules.digital.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.digital.api.CdnPurgeClient;
import java.net.URI;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * Object existence is authoritative; the presence row is only a hint. Every combination
 * of row state × probe outcome is pinned: conclusive misses heal the row, inconclusive
 * probes never mutate it.
 */
@ExtendWith(MockitoExtension.class)
class GeneratedFeedSnapshotStoreTest {

    @Mock
    private FeedSnapshotStateStore snapshotStateStore;

    @Mock
    private ObjectProvider<S3Client> s3Provider;

    @Mock
    private S3Client s3Client;

    @Mock
    private PrivateObjectUrlSigner privateObjectUrlSigner;

    @Mock
    private ObjectProvider<CdnPurgeClient> cdnPurgeProvider;

    @Mock
    private S3PublicUrlBuilder publicUrlBuilder;

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private DirectwerkProperties.Storage storage;

    private GeneratedFeedSnapshotStore store;

    private final FeedSnapshotRef ref =
            new FeedSnapshotRef(10L, "alpha", "alpha/feeds/podcast.xml", false, "TENANT", 0L);

    @BeforeEach
    void setUp() {
        when(directwerkConfig.isStorageEnabled()).thenReturn(true);
        when(directwerkConfig.storage()).thenReturn(storage);
        when(storage.bucket()).thenReturn("bucket");
        when(s3Provider.getIfAvailable()).thenReturn(s3Client);
        store = new GeneratedFeedSnapshotStore(
                snapshotStateStore,
                s3Provider,
                privateObjectUrlSigner,
                cdnPurgeProvider,
                publicUrlBuilder,
                directwerkConfig);
    }

    @Test
    void rowPresentAndObjectPresentDeliversWithoutRowMutation() throws Exception {
        when(snapshotStateStore.isWritten(10L, "TENANT", 0L)).thenReturn(true);
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().build());
        when(publicUrlBuilder.cdnUrl("alpha/feeds/podcast.xml"))
                .thenReturn(URI.create("https://cdn.test/alpha/feeds/podcast.xml").toURL());

        GeneratedFeedSnapshotStore.FeedDelivery delivery = store.deliver(ref);

        assertThat(delivery.ready()).isTrue();
        verify(snapshotStateStore, never()).markWritten(any(), any(), any(long.class));
        verify(snapshotStateStore, never()).clearWritten(any(), any(), any(long.class));
    }

    @Test
    void rowPresentButObjectGoneHealsTheRowAndReportsNotReady() {
        when(snapshotStateStore.isWritten(10L, "TENANT", 0L)).thenReturn(true);
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenThrow(NoSuchKeyException.builder().message("gone").build());

        GeneratedFeedSnapshotStore.FeedDelivery delivery = store.deliver(ref);

        assertThat(delivery.ready()).isFalse();
        verify(snapshotStateStore).clearWritten(10L, "TENANT", 0L);
    }

    @Test
    void rowAbsentButObjectPresentDeliversAndRemarksTheRow() throws Exception {
        when(snapshotStateStore.isWritten(10L, "TENANT", 0L)).thenReturn(false);
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().build());
        when(publicUrlBuilder.cdnUrl("alpha/feeds/podcast.xml"))
                .thenReturn(URI.create("https://cdn.test/alpha/feeds/podcast.xml").toURL());

        GeneratedFeedSnapshotStore.FeedDelivery delivery = store.deliver(ref);

        assertThat(delivery.ready()).isTrue();
        verify(snapshotStateStore).markWritten(10L, "TENANT", 0L);
    }

    @Test
    void rowAbsentAndObjectAbsentReportsNotReadyWithoutRowMutation() {
        when(snapshotStateStore.isWritten(10L, "TENANT", 0L)).thenReturn(false);
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenThrow((S3Exception) S3Exception.builder().statusCode(404).message("not found").build());

        GeneratedFeedSnapshotStore.FeedDelivery delivery = store.deliver(ref);

        assertThat(delivery.ready()).isFalse();
        verify(snapshotStateStore, never()).markWritten(any(), any(), any(long.class));
    }

    @Test
    void clientFailureFailsToTheLastKnownRowStateWithoutMutatingIt() throws Exception {
        SdkClientException blip = SdkClientException.create("connection failed");

        when(snapshotStateStore.isWritten(10L, "TENANT", 0L)).thenReturn(true);
        when(s3Client.headObject(any(HeadObjectRequest.class))).thenThrow(blip);
        when(publicUrlBuilder.cdnUrl("alpha/feeds/podcast.xml"))
                .thenReturn(URI.create("https://cdn.test/alpha/feeds/podcast.xml").toURL());

        assertThat(store.deliver(ref).ready()).isTrue();

        when(snapshotStateStore.isWritten(10L, "TENANT", 0L)).thenReturn(false);
        assertThat(store.deliver(ref).ready()).isFalse();

        verify(snapshotStateStore, never()).markWritten(any(), any(), any(long.class));
        verify(snapshotStateStore, never()).clearWritten(any(), any(), any(long.class));
    }
}
