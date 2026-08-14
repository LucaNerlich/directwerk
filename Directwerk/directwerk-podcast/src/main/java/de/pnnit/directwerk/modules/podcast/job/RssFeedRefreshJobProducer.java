package de.pnnit.directwerk.modules.podcast.job;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.content.TenantRssSnapshotStaleEvent;
import de.pnnit.directwerk.modules.podcast.service.RssSnapshotStateStore;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

/** Enqueues durable RSS regeneration only after the content transaction commits. */
@Service
public class RssFeedRefreshJobProducer {

    private final ObjectProvider<QueueService> queueService;
    private final ObjectMapper objectMapper;
    private final DirectwerkConfig directwerkConfig;
    private final RssSnapshotStateStore snapshotStateStore;

    public RssFeedRefreshJobProducer(
            ObjectProvider<QueueService> queueService,
            ObjectMapper objectMapper,
            DirectwerkConfig directwerkConfig,
            RssSnapshotStateStore snapshotStateStore
    ) {
        this.queueService = queueService;
        this.objectMapper = objectMapper;
        this.directwerkConfig = directwerkConfig;
        this.snapshotStateStore = snapshotStateStore;
    }

    public void requestRefreshAfterCommit(Long tenantId) {
        if (tenantId == null || tenantId < 1) {
            throw new IllegalArgumentException("tenantId must be a positive id");
        }
        runAfterCommit(() -> requestRefresh(tenantId));
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
                RssFeedRefreshQueueNames.RSS_FEED_REFRESH,
                objectMapper.valueToTree(new RssFeedRefreshJobPayload(tenantId)),
                0,
                null,
                null,
                new JobEnqueueMetadata(tenantId, "rss-feed-refresh-" + tenantId, null)
        );
    }

    private static void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
            return;
        }
        action.run();
    }
}
