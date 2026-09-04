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
