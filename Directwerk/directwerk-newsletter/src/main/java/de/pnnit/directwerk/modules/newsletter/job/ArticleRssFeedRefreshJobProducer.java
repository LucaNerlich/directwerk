package de.pnnit.directwerk.modules.newsletter.job;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.digital.storage.FeedRefreshJobProducerSupport;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.QueueService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/** Enqueues durable article RSS regeneration only after the content transaction commits. */
@Service
public class ArticleRssFeedRefreshJobProducer extends FeedRefreshJobProducerSupport {

    public ArticleRssFeedRefreshJobProducer(
            ObjectProvider<QueueService> queueService,
            ObjectMapper objectMapper,
            DirectwerkConfig directwerkConfig,
            FeedSnapshotStateStore snapshotStateStore
    ) {
        super(
                queueService,
                objectMapper,
                directwerkConfig,
                snapshotStateStore,
                QueueNames.ARTICLE_RSS_FEED_REFRESH,
                ArticleRssFeedRefreshJobPayload::new
        );
    }
}
