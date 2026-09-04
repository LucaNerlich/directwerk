package de.pnnit.directwerk.modules.newsletter.job;

import de.pnnit.directwerk.modules.newsletter.service.ArticleRssFeedSnapshotService;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.TenantRefreshJobHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class ArticleRssFeedRefreshJobHandler extends TenantRefreshJobHandler<ArticleRssFeedRefreshJobPayload> {

    public ArticleRssFeedRefreshJobHandler(ObjectMapper objectMapper, ArticleRssFeedSnapshotService snapshotService) {
        super(
                objectMapper,
                ArticleRssFeedRefreshJobPayload.class,
                ArticleRssFeedRefreshJobPayload::tenantId,
                QueueNames.ARTICLE_RSS_FEED_REFRESH,
                snapshotService::refreshTenant
        );
    }
}
