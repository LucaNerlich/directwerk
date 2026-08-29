package de.pnnit.directwerk.modules.podcast.quartz;

import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedProvisioningService;
import lombok.extern.slf4j.Slf4j;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobExecutionContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;

@Slf4j
@DisallowConcurrentExecution
@SuppressWarnings("SpringJavaAutowiredMembersInspection")
public class DefaultSubscriberFeedProvisioningJob extends QuartzJobBean {

    private SubscriberFeedProvisioningService subscriberFeedProvisioningService;

    @Autowired
    public void setSubscriberFeedProvisioningService(
            SubscriberFeedProvisioningService subscriberFeedProvisioningService
    ) {
        this.subscriberFeedProvisioningService = subscriberFeedProvisioningService;
    }

    @Override
    protected void executeInternal(JobExecutionContext context) throws org.quartz.JobExecutionException {
        try {
            subscriberFeedProvisioningService.provisionMissingDefaultFeeds();
        } catch (Exception ex) {
            log.error(
                    "Default subscriber feed provisioning job failed job={} trigger={} fireTime={}",
                    context.getJobDetail().getKey(),
                    context.getTrigger().getKey(),
                    context.getFireTime(),
                    ex
            );
            throw new org.quartz.JobExecutionException("Default subscriber feed provisioning batch failed", ex);
        }
    }
}
