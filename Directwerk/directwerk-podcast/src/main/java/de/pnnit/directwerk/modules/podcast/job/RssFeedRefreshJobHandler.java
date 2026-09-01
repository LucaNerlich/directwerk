package de.pnnit.directwerk.modules.podcast.job;

import de.pnnit.directwerk.modules.podcast.service.RssFeedSnapshotService;
import de.pnnit.directwerk.modules.queue.JobHandler;
import de.pnnit.directwerk.modules.queue.JobHandlerSettings;
import de.pnnit.directwerk.modules.queue.QueueJob;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class RssFeedRefreshJobHandler implements JobHandler {

    private final ObjectMapper objectMapper;
    private final RssFeedSnapshotService snapshotService;

    public RssFeedRefreshJobHandler(ObjectMapper objectMapper, RssFeedSnapshotService snapshotService) {
        this.objectMapper = objectMapper;
        this.snapshotService = snapshotService;
    }

    @Override
    public String queueName() {
        return RssFeedRefreshQueueNames.PODCAST_RSS_FEED_REFRESH;
    }

    @Override
    public JobHandlerSettings settings() {
        return new JobHandlerSettings(900L, 60L, 8);
    }

    @Override
    public void handle(QueueJob job) {
        RssFeedRefreshJobPayload payload = objectMapper.convertValue(
                job.payload(), RssFeedRefreshJobPayload.class
        );
        if (payload == null || payload.tenantId() == null || payload.tenantId() < 1) {
            throw new IllegalArgumentException("Invalid RSS refresh job payload");
        }
        snapshotService.refreshTenant(payload.tenantId());
    }
}
