package de.pnnit.directwerk.modules.email.config;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.email.quartz.EmailDeliveryCleanupJob;
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
public class EmailQuartzConfig {

    public static final String CLEANUP_JOB_IDENTITY = "emailDeliveryCleanupJob";
    public static final String CLEANUP_TRIGGER_IDENTITY = "emailDeliveryCleanupTrigger";

    @Bean
    JobDetail emailDeliveryCleanupJobDetail() {
        return JobBuilder.newJob(EmailDeliveryCleanupJob.class)
                .withIdentity(CLEANUP_JOB_IDENTITY)
                .storeDurably()
                .build();
    }

    @Bean
    Trigger emailDeliveryCleanupTrigger(
            @Qualifier("emailDeliveryCleanupJobDetail") JobDetail emailDeliveryCleanupJobDetail,
            DirectwerkConfig directwerkConfig) {
        long intervalMs = Math.max(60_000L, directwerkConfig.queue().cleanupIntervalMs());
        return TriggerBuilder.newTrigger()
                .forJob(emailDeliveryCleanupJobDetail)
                .withIdentity(CLEANUP_TRIGGER_IDENTITY)
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInMilliseconds(intervalMs)
                        .repeatForever())
                .startNow()
                .build();
    }
}
