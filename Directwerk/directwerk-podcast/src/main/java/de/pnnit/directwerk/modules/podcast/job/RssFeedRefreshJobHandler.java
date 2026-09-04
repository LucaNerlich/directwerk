package de.pnnit.directwerk.modules.podcast.job;

import de.pnnit.directwerk.modules.podcast.service.RssFeedSnapshotService;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.TenantRefreshJobHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class RssFeedRefreshJobHandler extends TenantRefreshJobHandler<RssFeedRefreshJobPayload> {

    public RssFeedRefreshJobHandler(ObjectMapper objectMapper, RssFeedSnapshotService snapshotService) {
        super(
                objectMapper,
                RssFeedRefreshJobPayload.class,
                RssFeedRefreshJobPayload::tenantId,
                QueueNames.PODCAST_RSS_FEED_REFRESH,
                snapshotService::refreshTenant
        );
    }
}
