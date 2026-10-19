package de.pnnit.directwerk.modules.queue.quartz;

import lombok.extern.slf4j.Slf4j;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.scheduling.quartz.QuartzJobBean;

/**
 * Scheduled backfill of missing default private feeds.
 *
 * <p>Podcast and article feeds run the same batch; only the provisioning service
 * differs. The failure logging and the rethrow that lets Quartz record the failure
 * live here so an operator sees identical diagnostics for both jobs.</p>
 */
@Slf4j
public abstract class AbstractDefaultFeedProvisioningJob extends QuartzJobBean {

    /**
     * Runs one backfill batch.
     *
     * @return the number of feeds created
     */
    protected abstract int provisionMissingDefaultFeeds();

    /**
     * Human-readable job subject used in failure logs.
     */
    protected abstract String jobLabel();

    @Override
    protected final void executeInternal(JobExecutionContext context) throws JobExecutionException {
        try {
            provisionMissingDefaultFeeds();
        } catch (Exception ex) {
            log.error(
                    "{} job failed job={} trigger={} fireTime={}",
                    jobLabel(),
                    context.getJobDetail().getKey(),
                    context.getTrigger().getKey(),
                    context.getFireTime(),
                    ex
            );
            throw new JobExecutionException(jobLabel() + " batch failed", ex);
        }
    }
}
