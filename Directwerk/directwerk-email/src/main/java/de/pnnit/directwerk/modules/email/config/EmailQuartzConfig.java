package de.pnnit.directwerk.modules.email.config;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.email.quartz.EmailDeliveryCleanupJob;
import org.quartz.JobDetail;
import de.pnnit.directwerk.modules.queue.quartz.QuartzJobDefinitions;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(prefix = "directwerk.queue", name = "enabled", havingValue = "true", matchIfMissing = true)
public class EmailQuartzConfig {

    public static final String CLEANUP_JOB_IDENTITY = "emailDeliveryCleanupJob";
    public static final String CLEANUP_TRIGGER_IDENTITY = "emailDeliveryCleanupTrigger";

    @Bean
    JobDetail emailDeliveryCleanupJobDetail() {
        return QuartzJobDefinitions.durableJob(EmailDeliveryCleanupJob.class, CLEANUP_JOB_IDENTITY);
    }

    @Bean
    Trigger emailDeliveryCleanupTrigger(
            @Qualifier("emailDeliveryCleanupJobDetail") JobDetail emailDeliveryCleanupJobDetail,
            DirectwerkConfig directwerkConfig) {
        long intervalMs = Math.max(60_000L, directwerkConfig.queue().cleanupIntervalMs());
        return QuartzJobDefinitions.repeatingTriggerMillis(
                emailDeliveryCleanupJobDetail, CLEANUP_TRIGGER_IDENTITY, intervalMs);
    }
}
