package de.pnnit.directwerk.modules.podcast.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.FeatureModuleKeys;
import de.pnnit.directwerk.modules.core.feed.DefaultFeedProvisioningService;
import de.pnnit.directwerk.modules.core.feed.DefaultFeedStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SubscriberFeedProvisioningServiceTest {

    @Mock
    private SubscriberFeedService subscriberFeedService;

    @Mock
    private DefaultFeedProvisioningService defaultFeedProvisioningService;

    @InjectMocks
    private SubscriberFeedProvisioningService subscriberFeedProvisioningService;

    @Test
    void provisionDefaultFeedDelegatesWithPodcastRssKey() {
        subscriberFeedProvisioningService.provisionDefaultFeed(10L, 20L);

        verify(defaultFeedProvisioningService).provisionDefaultFeed(
                eq(FeatureModuleKeys.PODCAST_RSS), eq(10L), eq(20L), any(DefaultFeedStore.class)
        );
    }

    @Test
    void backfillDelegatesWithPodcastRssKey() {
        when(defaultFeedProvisioningService.provisionMissingDefaultFeeds(eq(FeatureModuleKeys.PODCAST_RSS), any()))
                .thenReturn(2);

        assertThat(subscriberFeedProvisioningService.provisionMissingDefaultFeeds()).isEqualTo(2);
    }

    @Test
    void storeProxiesToSubscriberFeedService() {
        when(subscriberFeedService.hasDefaultFeed(10L, 20L)).thenReturn(true);

        assertThat(subscriberFeedProvisioningService.hasDefaultFeed(10L, 20L)).isTrue();
        subscriberFeedProvisioningService.ensureDefaultFeed(10L, 20L);

        verify(subscriberFeedService).ensureDefaultFeed(10L, 20L);
    }
}
