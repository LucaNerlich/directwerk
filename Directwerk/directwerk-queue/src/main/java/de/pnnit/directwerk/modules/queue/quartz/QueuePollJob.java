package de.pnnit.directwerk.modules.queue.quartz;

import de.pnnit.directwerk.modules.queue.QueueWorker;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobExecutionContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;

/**
 * Quartz trigger that polls registered job handlers via {@link QueueWorker}.
 * Dependencies are setter-injected because Quartz instantiates jobs via a no-arg constructor;
 * Spring Boot's {@code SpringBeanJobFactory} then autowires each instance (not a Spring singleton).
 */
@DisallowConcurrentExecution
@SuppressWarnings("SpringJavaAutowiredMembersInspection")
public class QueuePollJob extends QuartzJobBean {

    private QueueWorker queueWorker;

    @Autowired
    public void setQueueWorker(QueueWorker queueWorker) {
        this.queueWorker = queueWorker;
    }

    @Override
    protected void executeInternal(JobExecutionContext context) {
        queueWorker.pollAll();
    }
}
