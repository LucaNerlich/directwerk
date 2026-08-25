package de.pnnit.directwerk.modules.podcast.quartz;

import de.pnnit.directwerk.modules.podcast.service.PublicationWorkflowService;
import lombok.extern.slf4j.Slf4j;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobExecutionContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;

@Slf4j
@DisallowConcurrentExecution
@SuppressWarnings("SpringJavaAutowiredMembersInspection")
public class ScheduledEpisodePublishJob extends QuartzJobBean {

    private PublicationWorkflowService publicationWorkflowService;

    @Autowired
    public void setPublicationWorkflowService(PublicationWorkflowService publicationWorkflowService) {
        this.publicationWorkflowService = publicationWorkflowService;
    }

    @Override
    protected void executeInternal(JobExecutionContext context) throws org.quartz.JobExecutionException {
        try {
            publicationWorkflowService.publishDueScheduled();
        } catch (Exception ex) {
            log.error(
                    "Scheduled episode publish job failed job={} trigger={} fireTime={}",
                    context.getJobDetail().getKey(),
                    context.getTrigger().getKey(),
                    context.getFireTime(),
                    ex
            );
            throw new org.quartz.JobExecutionException("Scheduled episode publish batch failed", ex);
        }
    }
}
