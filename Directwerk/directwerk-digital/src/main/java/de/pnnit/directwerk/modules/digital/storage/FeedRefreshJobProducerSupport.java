package de.pnnit.directwerk.modules.digital.storage;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.content.TenantRssSnapshotStaleEvent;
import de.pnnit.directwerk.modules.queue.QueueService;
import de.pnnit.directwerk.modules.queue.TenantRefreshJobProducer;
import java.util.function.Function;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.event.EventListener;
import tools.jackson.databind.ObjectMapper;

/**
 * Shared behaviour for the podcast and article RSS-refresh producers: durable
 * enqueue-after-commit, entitlement-change refresh, and stale-snapshot handling.
 * Kinds supply only their queue name and payload factory.
 */
public abstract class FeedRefreshJobProducerSupport {

    private final TenantRefreshJobProducer delegate;
    private final FeedSnapshotStateStore snapshotStateStore;

    protected FeedRefreshJobProducerSupport(
            ObjectProvider<QueueService> queueService,
            ObjectMapper objectMapper,
            DirectwerkConfig directwerkConfig,
            FeedSnapshotStateStore snapshotStateStore,
            String queueName,
            Function<Long, Object> payloadFactory
    ) {
        this.delegate = new TenantRefreshJobProducer(
                queueService,
                objectMapper,
                directwerkConfig,
                queueName,
                payloadFactory
        );
        this.snapshotStateStore = snapshotStateStore;
    }

    /**
     * Schedules an RSS feed refresh for the specified tenant after the current
     * transaction commits.
     */
    public void requestRefreshAfterCommit(Long tenantId) {
        delegate.requestRefreshAfterCommit(tenantId);
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
}
