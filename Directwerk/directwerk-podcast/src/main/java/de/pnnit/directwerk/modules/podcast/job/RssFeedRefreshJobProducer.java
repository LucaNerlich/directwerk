package de.pnnit.directwerk.modules.podcast.job;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.content.TenantRssSnapshotStaleEvent;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.QueueService;
import de.pnnit.directwerk.modules.queue.TenantRefreshJobProducer;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/** Enqueues durable RSS regeneration only after the content transaction commits. */
@Service
public class RssFeedRefreshJobProducer {

    private final TenantRefreshJobProducer delegate;
    private final FeedSnapshotStateStore snapshotStateStore;

    /**
     * Creates a producer for tenant podcast RSS feed refresh jobs.
     */
    public RssFeedRefreshJobProducer(
            ObjectProvider<QueueService> queueService,
            ObjectMapper objectMapper,
            DirectwerkConfig directwerkConfig,
            FeedSnapshotStateStore snapshotStateStore
    ) {
        this.delegate = new TenantRefreshJobProducer(
                queueService,
                objectMapper,
                directwerkConfig,
                QueueNames.PODCAST_RSS_FEED_REFRESH,
                RssFeedRefreshJobPayload::new
        );
        this.snapshotStateStore = snapshotStateStore;
    }

    /**
     * Schedules an RSS feed refresh for the specified tenant after the current transaction commits.
     *
     * @param tenantId the tenant whose RSS feed should be refreshed
     */
    public void requestRefreshAfterCommit(Long tenantId) {
        delegate.requestRefreshAfterCommit(tenantId);
    }

    /**
     * Requests an RSS feed refresh after a tenant's entitlements change.
     *
     * @param event the tenant entitlement change event
     */
    @EventListener
    public void onEntitlementsChanged(TenantEntitlementsChangedEvent event) {
        requestRefreshAfterCommit(event.tenantId());
    }

    /**
     * Handles a stale RSS snapshot event by recording the previous slug, clearing the written snapshot state,
     * and scheduling a refresh for the affected tenant.
     *
     * @param event the event describing the tenant whose RSS snapshot is stale
     */
    @EventListener
    public void onSnapshotStale(TenantRssSnapshotStaleEvent event) {
        if (event.previousSlug() != null) {
            snapshotStateStore.recordStalePrefix(event.tenantId(), event.previousSlug());
            snapshotStateStore.clearWritten(event.tenantId());
        }
        requestRefreshAfterCommit(event.tenantId());
    }
}
