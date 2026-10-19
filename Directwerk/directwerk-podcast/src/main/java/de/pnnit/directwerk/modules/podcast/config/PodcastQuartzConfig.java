package de.pnnit.directwerk.modules.podcast.config;

import de.pnnit.directwerk.modules.podcast.quartz.DefaultSubscriberFeedProvisioningJob;
import de.pnnit.directwerk.modules.podcast.quartz.ScheduledEpisodePublishJob;
import de.pnnit.directwerk.modules.queue.quartz.QuartzJobDefinitions;
import org.quartz.JobDetail;
import org.quartz.Trigger;
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
        return QuartzJobDefinitions.durableJob(ScheduledEpisodePublishJob.class, JOB_IDENTITY);
    }

    @Bean
    Trigger scheduledEpisodePublishTrigger(
            @Qualifier("scheduledEpisodePublishJobDetail") JobDetail scheduledEpisodePublishJobDetail,
            @Value("${directwerk.podcast.scheduled-publish-interval-seconds:60}") int intervalSeconds
    ) {
        return QuartzJobDefinitions.repeatingTrigger(
                scheduledEpisodePublishJobDetail,
                TRIGGER_IDENTITY,
                intervalSeconds
        );
    }

    @Bean
    JobDetail defaultSubscriberFeedProvisioningJobDetail() {
        return QuartzJobDefinitions.durableJob(DefaultSubscriberFeedProvisioningJob.class, DEFAULT_FEED_JOB_IDENTITY);
    }

    @Bean
    Trigger defaultSubscriberFeedProvisioningTrigger(
            @Qualifier("defaultSubscriberFeedProvisioningJobDetail") JobDetail defaultSubscriberFeedProvisioningJobDetail,
            @Value("${directwerk.podcast.default-feed-provisioning-interval-seconds:300}") int intervalSeconds
    ) {
        return QuartzJobDefinitions.repeatingTrigger(
                defaultSubscriberFeedProvisioningJobDetail,
                DEFAULT_FEED_TRIGGER_IDENTITY,
                intervalSeconds
        );
    }
}
