package de.pnnit.directwerk.modules.newsletter.job;

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

/** Enqueues durable article RSS regeneration only after the content transaction commits. */
@Service
public class ArticleRssFeedRefreshJobProducer {

    private final TenantRefreshJobProducer delegate;
    private final FeedSnapshotStateStore snapshotStateStore;

    /**
     * Creates a producer for article RSS feed refresh jobs.
     *
     * @param queueService       the queue service provider used to enqueue refresh jobs
     * @param objectMapper       the object mapper used to serialize job payloads
     * @param directwerkConfig   the application configuration for job enqueueing
     * @param snapshotStateStore the store for tenant RSS snapshot state
     */
    public ArticleRssFeedRefreshJobProducer(
            ObjectProvider<QueueService> queueService,
            ObjectMapper objectMapper,
            DirectwerkConfig directwerkConfig,
            FeedSnapshotStateStore snapshotStateStore
    ) {
        this.delegate = new TenantRefreshJobProducer(
                queueService,
                objectMapper,
                directwerkConfig,
                QueueNames.ARTICLE_RSS_FEED_REFRESH,
                ArticleRssFeedRefreshJobPayload::new
        );
        this.snapshotStateStore = snapshotStateStore;
    }

    /**
     * Requests regeneration of the tenant's article RSS feed after the current transaction commits.
     *
     * @param tenantId the tenant whose RSS feed should be regenerated
     */
    public void requestRefreshAfterCommit(Long tenantId) {
        delegate.requestRefreshAfterCommit(tenantId);
    }

    /**
     * Requests an article RSS feed refresh when a tenant's entitlements change.
     *
     * @param event the tenant entitlements change event
     */
    @EventListener
    public void onEntitlementsChanged(TenantEntitlementsChangedEvent event) {
        requestRefreshAfterCommit(event.tenantId());
    }

    /**
     * Handles a stale RSS snapshot event by recording the previous slug, clearing the
     * written snapshot state when applicable, and scheduling a tenant refresh.
     *
     * @param event the event containing the tenant identifier and optional previous slug
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
