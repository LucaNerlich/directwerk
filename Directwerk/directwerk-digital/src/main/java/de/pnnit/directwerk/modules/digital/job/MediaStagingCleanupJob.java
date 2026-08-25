package de.pnnit.directwerk.modules.digital.job;

import lombok.extern.slf4j.Slf4j;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobExecutionContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;

/**
 * Recurring trigger that purges expired staging objects. Replaces the non-functional bucket
 * lifecycle rule (Bunny S3 does not support lifecycle policies).
 */
@Slf4j
@DisallowConcurrentExecution
@SuppressWarnings("SpringJavaAutowiredMembersInspection")
public class MediaStagingCleanupJob extends QuartzJobBean {

    private StagingCleanupService stagingCleanupService;

    @Autowired
    public void setStagingCleanupService(StagingCleanupService stagingCleanupService) {
        this.stagingCleanupService = stagingCleanupService;
    }

    @Override
    protected void executeInternal(JobExecutionContext context) throws org.quartz.JobExecutionException {
        try {
            stagingCleanupService.cleanupExpiredStaging();
        } catch (Exception ex) {
            log.error(
                    "Staging cleanup job failed job={} trigger={} fireTime={}",
                    context.getJobDetail().getKey(),
                    context.getTrigger().getKey(),
                    context.getFireTime(),
                    ex
            );
            throw new org.quartz.JobExecutionException("Staging cleanup batch failed", ex);
        }
    }
}
