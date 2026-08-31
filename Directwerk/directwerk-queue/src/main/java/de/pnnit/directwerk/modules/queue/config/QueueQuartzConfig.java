package de.pnnit.directwerk.modules.queue.config;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.queue.quartz.QueueCleanupJob;
import de.pnnit.directwerk.modules.queue.quartz.QueuePollJob;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(prefix = "directwerk.queue", name = "enabled", havingValue = "true", matchIfMissing = true)
public class QueueQuartzConfig {

    public static final String JOB_IDENTITY = "queuePollJob";
    public static final String TRIGGER_IDENTITY = "queuePollTrigger";
    public static final String CLEANUP_JOB_IDENTITY = "queueCleanupJob";
    public static final String CLEANUP_TRIGGER_IDENTITY = "queueCleanupTrigger";

    @Bean
    JobDetail queuePollJobDetail() {
        return JobBuilder.newJob(QueuePollJob.class)
                .withIdentity(JOB_IDENTITY)
                .storeDurably()
                .build();
    }

    @Bean
    Trigger queuePollTrigger(
            @Qualifier("queuePollJobDetail") JobDetail queuePollJobDetail,
            DirectwerkConfig directwerkConfig) {
        long intervalMs = Math.max(1000L, directwerkConfig.queue().pollIntervalMs());
        return TriggerBuilder.newTrigger()
                .forJob(queuePollJobDetail)
                .withIdentity(TRIGGER_IDENTITY)
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInMilliseconds(intervalMs)
                        .repeatForever())
                .startNow()
                .build();
    }

    @Bean
    JobDetail queueCleanupJobDetail() {
        return JobBuilder.newJob(QueueCleanupJob.class)
                .withIdentity(CLEANUP_JOB_IDENTITY)
                .storeDurably()
                .build();
    }

    @Bean
    Trigger queueCleanupTrigger(
            @Qualifier("queueCleanupJobDetail") JobDetail queueCleanupJobDetail,
            DirectwerkConfig directwerkConfig) {
        // Minimum 1 minute between cleanup runs to avoid tight loops from misconfiguration.
        long intervalMs = Math.max(60_000L, directwerkConfig.queue().cleanupIntervalMs());
        return TriggerBuilder.newTrigger()
                .forJob(queueCleanupJobDetail)
                .withIdentity(CLEANUP_TRIGGER_IDENTITY)
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInMilliseconds(intervalMs)
                        .repeatForever())
                .startNow()
                .build();
    }
}
