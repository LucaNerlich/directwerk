package de.pnnit.directwerk.modules.digital.config;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.digital.job.MediaStagingCleanupJob;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Schedules the app-side staging cleanup job. Active only when object storage is enabled, since the
 * job depends on the {@code S3Client} and {@code StagingCleanupService} beans.
 */
@Configuration
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
public class MediaQuartzConfig {

    public static final String STAGING_CLEANUP_JOB_IDENTITY = "mediaStagingCleanupJob";
    public static final String STAGING_CLEANUP_TRIGGER_IDENTITY = "mediaStagingCleanupTrigger";

    @Bean
    JobDetail mediaStagingCleanupJobDetail() {
        return JobBuilder.newJob(MediaStagingCleanupJob.class)
                .withIdentity(STAGING_CLEANUP_JOB_IDENTITY)
                .storeDurably()
                .build();
    }

    @Bean
    Trigger mediaStagingCleanupTrigger(
            @Qualifier("mediaStagingCleanupJobDetail") JobDetail mediaStagingCleanupJobDetail,
            DirectwerkConfig directwerkConfig) {
        long intervalMs = Math.max(60_000L, directwerkConfig.storage().stagingCleanupIntervalMs());
        return TriggerBuilder.newTrigger()
                .forJob(mediaStagingCleanupJobDetail)
                .withIdentity(STAGING_CLEANUP_TRIGGER_IDENTITY)
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInMilliseconds(intervalMs)
                        .repeatForever())
                .startNow()
                .build();
    }
}
