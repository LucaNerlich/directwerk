package de.pnnit.directwerk.modules.podcast.job;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.content.TenantRssSnapshotStaleEvent;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.podcast.service.RssFeedRefreshScheduler;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import de.pnnit.directwerk.modules.core.transaction.TransactionAfterCommit;
import tools.jackson.databind.ObjectMapper;

/** Enqueues durable RSS regeneration only after the content transaction commits. */
@Service
public class RssFeedRefreshJobProducer implements RssFeedRefreshScheduler {

    private final ObjectProvider<QueueService> queueService;
    private final ObjectMapper objectMapper;
    private final DirectwerkConfig directwerkConfig;
    private final FeedSnapshotStateStore snapshotStateStore;

    public RssFeedRefreshJobProducer(
            ObjectProvider<QueueService> queueService,
            ObjectMapper objectMapper,
            DirectwerkConfig directwerkConfig,
            FeedSnapshotStateStore snapshotStateStore
    ) {
        this.queueService = queueService;
        this.objectMapper = objectMapper;
        this.directwerkConfig = directwerkConfig;
        this.snapshotStateStore = snapshotStateStore;
    }

    @Override
    public void requestRefreshAfterCommit(Long tenantId) {
        if (tenantId == null || tenantId < 1) {
            throw new IllegalArgumentException("tenantId must be a positive id");
        }
        TransactionAfterCommit.run(() -> requestRefresh(tenantId));
    }

    @EventListener
    public void onEntitlementsChanged(TenantEntitlementsChangedEvent event) {
        requestRefreshAfterCommit(event.tenantId());
    }

    @EventListener
    public void onSnapshotStale(TenantRssSnapshotStaleEvent event) {
        if (event.previousSlug() != null) {
            snapshotStateStore.recordStalePrefix(event.tenantId(), event.previousSlug());
            snapshotStateStore.clearWritten(event.tenantId());
        }
        requestRefreshAfterCommit(event.tenantId());
    }

    private void requestRefresh(Long tenantId) {
        if (!directwerkConfig.isQueueEnabled()) {
            return;
        }
        queueService.getObject().enqueue(
                RssFeedRefreshQueueNames.PODCAST_RSS_FEED_REFRESH,
                objectMapper.valueToTree(new RssFeedRefreshJobPayload(tenantId)),
                0,
                null,
                null,
                new JobEnqueueMetadata(
                        tenantId,
                        RssFeedRefreshQueueNames.PODCAST_RSS_FEED_REFRESH + "-" + tenantId,
                        null
                )
        );
    }
}
