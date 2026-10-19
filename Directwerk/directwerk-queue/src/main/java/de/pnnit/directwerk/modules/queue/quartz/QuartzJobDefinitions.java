package de.pnnit.directwerk.modules.queue.quartz;

import org.quartz.Job;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;

/**
 * Builders shared by the module Quartz configurations.
 *
 * <p>Every module registers the same shape — a durable job detail plus a repeating
 * trigger keyed by its own identities. Bean names stay module-local; only the wiring
 * is shared, so a scheduling fix cannot drift between modules.</p>
 */
public final class QuartzJobDefinitions {

    private QuartzJobDefinitions() {
    }

    /**
     * Builds a durable job detail.
     *
     * @param jobClass the Quartz job class
     * @param identity the job identity
     * @return the durable job detail
     */
    public static JobDetail durableJob(Class<? extends Job> jobClass, String identity) {
        return JobBuilder.newJob(jobClass)
                .withIdentity(identity)
                .storeDurably()
                .build();
    }

    /**
     * Builds a trigger that fires immediately and then repeats forever.
     *
     * @param jobDetail     the job to schedule
     * @param identity      the trigger identity
     * @param intervalSeconds the repeat interval in seconds
     * @return the repeating trigger
     */
    public static Trigger repeatingTrigger(JobDetail jobDetail, String identity, int intervalSeconds) {
        return TriggerBuilder.newTrigger()
                .forJob(jobDetail)
                .withIdentity(identity)
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInSeconds(intervalSeconds)
                        .repeatForever())
                .startNow()
                .build();
    }
}
