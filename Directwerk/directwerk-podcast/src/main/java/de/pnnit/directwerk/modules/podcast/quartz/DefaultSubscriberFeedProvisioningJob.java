package de.pnnit.directwerk.modules.podcast.quartz;

import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedProvisioningService;
import de.pnnit.directwerk.modules.queue.quartz.AbstractDefaultFeedProvisioningJob;
import org.quartz.DisallowConcurrentExecution;
import org.springframework.beans.factory.annotation.Autowired;

@DisallowConcurrentExecution
@SuppressWarnings("SpringJavaAutowiredMembersInspection")
public class DefaultSubscriberFeedProvisioningJob extends AbstractDefaultFeedProvisioningJob {

    private SubscriberFeedProvisioningService subscriberFeedProvisioningService;

    @Autowired
    public void setSubscriberFeedProvisioningService(
            SubscriberFeedProvisioningService subscriberFeedProvisioningService
    ) {
        this.subscriberFeedProvisioningService = subscriberFeedProvisioningService;
    }

    @Override
    protected int provisionMissingDefaultFeeds() {
        return subscriberFeedProvisioningService.provisionMissingDefaultFeeds();
    }

    @Override
    protected String jobLabel() {
        return "Default subscriber feed provisioning";
    }
}
