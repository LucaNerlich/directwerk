package de.pnnit.directwerk.modules.newsletter.quartz;

import de.pnnit.directwerk.modules.newsletter.service.ArticlePublicationWorkflowService;
import lombok.extern.slf4j.Slf4j;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobExecutionContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;

@Slf4j
@DisallowConcurrentExecution
@SuppressWarnings("SpringJavaAutowiredMembersInspection")
public class ScheduledArticlePublishJob extends QuartzJobBean {

    private ArticlePublicationWorkflowService articlePublicationWorkflowService;

    @Autowired
    public void setArticlePublicationWorkflowService(
            ArticlePublicationWorkflowService articlePublicationWorkflowService
    ) {
        this.articlePublicationWorkflowService = articlePublicationWorkflowService;
    }

    @Override
    protected void executeInternal(JobExecutionContext context) throws org.quartz.JobExecutionException {
        try {
            articlePublicationWorkflowService.publishDueScheduled();
        } catch (Exception ex) {
            log.error(
                    "Scheduled article publish job failed job={} trigger={} fireTime={}",
                    context.getJobDetail().getKey(),
                    context.getTrigger().getKey(),
                    context.getFireTime(),
                    ex
            );
            throw new org.quartz.JobExecutionException("Scheduled article publish batch failed", ex);
        }
    }
}
