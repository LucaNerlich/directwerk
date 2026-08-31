package de.pnnit.directwerk.modules.newsletter.quartz;

import de.pnnit.directwerk.modules.newsletter.service.ArticleFeedProvisioningService;
import lombok.extern.slf4j.Slf4j;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobExecutionContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;

@Slf4j
@DisallowConcurrentExecution
@SuppressWarnings("SpringJavaAutowiredMembersInspection")
public class DefaultArticleFeedProvisioningJob extends QuartzJobBean {

    private ArticleFeedProvisioningService articleFeedProvisioningService;

    @Autowired
    public void setArticleFeedProvisioningService(
            ArticleFeedProvisioningService articleFeedProvisioningService
    ) {
        this.articleFeedProvisioningService = articleFeedProvisioningService;
    }

    @Override
    protected void executeInternal(JobExecutionContext context) throws org.quartz.JobExecutionException {
        try {
            articleFeedProvisioningService.provisionMissingDefaultFeeds();
        } catch (Exception ex) {
            log.error(
                    "Default article feed provisioning job failed job={} trigger={} fireTime={}",
                    context.getJobDetail().getKey(),
                    context.getTrigger().getKey(),
                    context.getFireTime(),
                    ex
            );
            throw new org.quartz.JobExecutionException("Default article feed provisioning batch failed", ex);
        }
    }
}
