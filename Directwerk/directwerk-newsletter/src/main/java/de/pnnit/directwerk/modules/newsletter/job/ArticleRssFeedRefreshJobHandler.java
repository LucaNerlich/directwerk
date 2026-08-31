package de.pnnit.directwerk.modules.newsletter.job;

import de.pnnit.directwerk.modules.newsletter.service.ArticleRssFeedSnapshotService;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.JobHandlerSettings;
import de.pnnit.directwerk.modules.queue.QueueJob;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class ArticleRssFeedRefreshJobHandler implements JobHandler {

    private final ObjectMapper objectMapper;
    private final ArticleRssFeedSnapshotService snapshotService;

    public ArticleRssFeedRefreshJobHandler(ObjectMapper objectMapper, ArticleRssFeedSnapshotService snapshotService) {
        this.objectMapper = objectMapper;
        this.snapshotService = snapshotService;
    }

    @Override
    public String queueName() {
        return ArticleRssFeedRefreshQueueNames.ARTICLE_RSS_FEED_REFRESH;
    }

    @Override
    public JobHandlerSettings settings() {
        return new JobHandlerSettings(900L, 60L, 8);
    }

    @Override
    public void handle(QueueJob job) {
        ArticleRssFeedRefreshJobPayload payload = objectMapper.convertValue(
                job.payload(), ArticleRssFeedRefreshJobPayload.class
        );
        if (payload == null || payload.tenantId() == null || payload.tenantId() < 1) {
            throw new IllegalArgumentException("Invalid article RSS refresh job payload");
        }
        snapshotService.refreshTenant(payload.tenantId());
    }
}
