package de.pnnit.directwerk.modules.podcast.config;

import de.pnnit.directwerk.modules.podcast.quartz.DefaultSubscriberFeedProvisioningJob;
import de.pnnit.directwerk.modules.podcast.quartz.ScheduledEpisodePublishJob;
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
public class PodcastQuartzConfig {

    public static final String JOB_IDENTITY = "scheduledEpisodePublishJob";
    public static final String TRIGGER_IDENTITY = "scheduledEpisodePublishTrigger";
    public static final String DEFAULT_FEED_JOB_IDENTITY = "defaultSubscriberFeedProvisioningJob";
    public static final String DEFAULT_FEED_TRIGGER_IDENTITY = "defaultSubscriberFeedProvisioningTrigger";

    @Bean
    JobDetail scheduledEpisodePublishJobDetail() {
        return JobBuilder.newJob(ScheduledEpisodePublishJob.class)
                .withIdentity(JOB_IDENTITY)
                .storeDurably()
                .build();
    }

    @Bean
    Trigger scheduledEpisodePublishTrigger(
            @Qualifier("scheduledEpisodePublishJobDetail") JobDetail scheduledEpisodePublishJobDetail,
            @Value("${directwerk.podcast.scheduled-publish-interval-seconds:60}") int intervalSeconds
    ) {
        return TriggerBuilder.newTrigger()
                .forJob(scheduledEpisodePublishJobDetail)
                .withIdentity(TRIGGER_IDENTITY)
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInSeconds(intervalSeconds)
                        .repeatForever())
                .startNow()
                .build();
    }

    @Bean
    JobDetail defaultSubscriberFeedProvisioningJobDetail() {
        return JobBuilder.newJob(DefaultSubscriberFeedProvisioningJob.class)
                .withIdentity(DEFAULT_FEED_JOB_IDENTITY)
                .storeDurably()
                .build();
    }

    @Bean
    Trigger defaultSubscriberFeedProvisioningTrigger(
            @Qualifier("defaultSubscriberFeedProvisioningJobDetail") JobDetail defaultSubscriberFeedProvisioningJobDetail,
            @Value("${directwerk.podcast.default-feed-provisioning-interval-seconds:300}") int intervalSeconds
    ) {
        return TriggerBuilder.newTrigger()
                .forJob(defaultSubscriberFeedProvisioningJobDetail)
                .withIdentity(DEFAULT_FEED_TRIGGER_IDENTITY)
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInSeconds(intervalSeconds)
                        .repeatForever())
                .startNow()
                .build();
    }
}
