package de.pnnit.directwerk.modules.podcast.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.TenantRssSnapshotStaleEvent;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.QueueService;
import de.pnnit.directwerk.testsupport.TestObjectProviders;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;

class RssFeedRefreshJobProducerTest {

    @Test
    void queuesTenantRefreshWhenTheQueueIsEnabled() {
        QueueService queueService = mock(QueueService.class);
        ObjectProvider<QueueService> queueProvider = TestObjectProviders.returning(queueService);
        DirectwerkConfig config = mock(DirectwerkConfig.class);
        FeedSnapshotStateStore stateStore = mock(FeedSnapshotStateStore.class);
        when(config.isQueueEnabled()).thenReturn(true);
        RssFeedRefreshJobProducer producer = new RssFeedRefreshJobProducer(
                queueProvider,
                new ObjectMapper(),
                config,
                stateStore
        );

        producer.requestRefreshAfterCommit(10L);

        ArgumentCaptor<JsonNode> payload = ArgumentCaptor.forClass(JsonNode.class);
        ArgumentCaptor<JobEnqueueMetadata> metadata = ArgumentCaptor.forClass(JobEnqueueMetadata.class);
        verify(queueService).enqueue(
                eq(QueueNames.PODCAST_RSS_FEED_REFRESH),
                payload.capture(),
                eq(0),
                eq(null),
                eq(null),
                metadata.capture()
        );
        assertThat(payload.getValue().get("tenantId").asLong()).isEqualTo(10L);
        assertThat(metadata.getValue().tenantId()).isEqualTo(10L);
        assertThat(metadata.getValue().correlationId()).isEqualTo("podcast-rss-feed-refresh-10");
        verify(stateStore, never()).recordStalePrefix(any(), any());
    }

    @Test
    void snapshotStaleEventQueuesTheSameTenantRefresh() {
        QueueService queueService = mock(QueueService.class);
        ObjectProvider<QueueService> queueProvider = TestObjectProviders.returning(queueService);
        DirectwerkConfig config = mock(DirectwerkConfig.class);
        FeedSnapshotStateStore stateStore = mock(FeedSnapshotStateStore.class);
        when(config.isQueueEnabled()).thenReturn(true);
        RssFeedRefreshJobProducer producer = new RssFeedRefreshJobProducer(
                queueProvider,
                new ObjectMapper(),
                config,
                stateStore
        );

        producer.onSnapshotStale(new TenantRssSnapshotStaleEvent(10L));

        verify(queueService).enqueue(
                eq(QueueNames.PODCAST_RSS_FEED_REFRESH),
                any(JsonNode.class),
                eq(0),
                eq(null),
                eq(null),
                any(JobEnqueueMetadata.class)
        );
        verify(stateStore, never()).clearWritten(10L);
    }

    @Test
    void slugChangeRecordsTheOldPrefixAndClearsPresenceBeforeEnqueue() {
        QueueService queueService = mock(QueueService.class);
        ObjectProvider<QueueService> queueProvider = TestObjectProviders.returning(queueService);
        DirectwerkConfig config = mock(DirectwerkConfig.class);
        FeedSnapshotStateStore stateStore = mock(FeedSnapshotStateStore.class);
        when(config.isQueueEnabled()).thenReturn(true);
        RssFeedRefreshJobProducer producer = new RssFeedRefreshJobProducer(
                queueProvider,
                new ObjectMapper(),
                config,
                stateStore
        );

        producer.onSnapshotStale(new TenantRssSnapshotStaleEvent(10L, "old-alpha"));

        verify(stateStore).recordStalePrefix(10L, "old-alpha");
        verify(stateStore).clearWritten(10L);
        verify(queueService).enqueue(
                eq(QueueNames.PODCAST_RSS_FEED_REFRESH),
                any(JsonNode.class),
                eq(0),
                eq(null),
                eq(null),
                any(JobEnqueueMetadata.class)
        );
    }
}
