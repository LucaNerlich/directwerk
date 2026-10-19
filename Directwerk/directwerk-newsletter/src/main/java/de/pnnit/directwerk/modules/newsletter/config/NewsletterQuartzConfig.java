package de.pnnit.directwerk.modules.newsletter.config;

import de.pnnit.directwerk.modules.newsletter.quartz.DefaultArticleFeedProvisioningJob;
import de.pnnit.directwerk.modules.newsletter.quartz.ScheduledArticlePublishJob;
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
public class NewsletterQuartzConfig {

    public static final String JOB_IDENTITY = "scheduledArticlePublishJob";
    public static final String TRIGGER_IDENTITY = "scheduledArticlePublishTrigger";
    public static final String DEFAULT_FEED_JOB_IDENTITY = "defaultArticleFeedProvisioningJob";
    public static final String DEFAULT_FEED_TRIGGER_IDENTITY = "defaultArticleFeedProvisioningTrigger";

    @Bean
    JobDetail scheduledArticlePublishJobDetail() {
        return QuartzJobDefinitions.durableJob(ScheduledArticlePublishJob.class, JOB_IDENTITY);
    }

    @Bean
    Trigger scheduledArticlePublishTrigger(
            @Qualifier("scheduledArticlePublishJobDetail") JobDetail scheduledArticlePublishJobDetail,
            @Value("${directwerk.newsletter.scheduled-publish-interval-seconds:60}") int intervalSeconds
    ) {
        return QuartzJobDefinitions.repeatingTrigger(
                scheduledArticlePublishJobDetail,
                TRIGGER_IDENTITY,
                intervalSeconds
        );
    }

    @Bean
    JobDetail defaultArticleFeedProvisioningJobDetail() {
        return QuartzJobDefinitions.durableJob(DefaultArticleFeedProvisioningJob.class, DEFAULT_FEED_JOB_IDENTITY);
    }

    @Bean
    Trigger defaultArticleFeedProvisioningTrigger(
            @Qualifier("defaultArticleFeedProvisioningJobDetail") JobDetail defaultArticleFeedProvisioningJobDetail,
            @Value("${directwerk.newsletter.default-feed-provisioning-interval-seconds:300}") int intervalSeconds
    ) {
        return QuartzJobDefinitions.repeatingTrigger(
                defaultArticleFeedProvisioningJobDetail,
                DEFAULT_FEED_TRIGGER_IDENTITY,
                intervalSeconds
        );
    }
}
