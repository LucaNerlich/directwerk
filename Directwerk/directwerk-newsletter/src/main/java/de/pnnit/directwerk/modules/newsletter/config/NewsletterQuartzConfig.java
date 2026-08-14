package de.pnnit.directwerk.modules.newsletter.config;

import de.pnnit.directwerk.modules.newsletter.quartz.ScheduledArticlePublishJob;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(prefix = "directwerk.queue", name = "enabled", havingValue = "true", matchIfMissing = true)
public class NewsletterQuartzConfig {

    public static final String JOB_IDENTITY = "scheduledArticlePublishJob";
    public static final String TRIGGER_IDENTITY = "scheduledArticlePublishTrigger";

    @Bean
    JobDetail scheduledArticlePublishJobDetail() {
        return JobBuilder.newJob(ScheduledArticlePublishJob.class)
                .withIdentity(JOB_IDENTITY)
                .storeDurably()
                .build();
    }

    @Bean
    Trigger scheduledArticlePublishTrigger(
            @Qualifier("scheduledArticlePublishJobDetail") JobDetail scheduledArticlePublishJobDetail,
            @Value("${directwerk.newsletter.scheduled-publish-interval-seconds:60}") int intervalSeconds
    ) {
        return TriggerBuilder.newTrigger()
                .forJob(scheduledArticlePublishJobDetail)
                .withIdentity(TRIGGER_IDENTITY)
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInSeconds(intervalSeconds)
                        .repeatForever())
                .startNow()
                .build();
    }
}
