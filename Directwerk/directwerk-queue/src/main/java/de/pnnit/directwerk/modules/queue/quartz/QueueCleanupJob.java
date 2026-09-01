package de.pnnit.directwerk.modules.queue.quartz;

import de.pnnit.directwerk.modules.queue.QueueCleanupService;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobExecutionContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;

/**
 * Quartz trigger that purges stale terminal queue jobs.
 * Quartz constructs each instance; Spring Boot's {@code SpringBeanJobFactory} autowires it
 * (not a Spring singleton — do not add {@code @Component}).
 */
@DisallowConcurrentExecution
@SuppressWarnings("SpringJavaAutowiredMembersInspection")
public class QueueCleanupJob extends QuartzJobBean {

    private QueueCleanupService queueCleanupService;

    @Autowired
    public void setQueueCleanupService(QueueCleanupService queueCleanupService) {
        this.queueCleanupService = queueCleanupService;
    }

    @Override
    protected void executeInternal(JobExecutionContext context) {
        queueCleanupService.cleanup();
    }
}
