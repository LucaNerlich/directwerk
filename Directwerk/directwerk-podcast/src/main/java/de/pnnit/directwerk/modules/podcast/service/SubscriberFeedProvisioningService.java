package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.FeatureModuleKeys;
import de.pnnit.directwerk.modules.core.feed.DefaultFeedProvisioningService;
import de.pnnit.directwerk.modules.core.feed.DefaultFeedStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Podcast adapter over {@link DefaultFeedProvisioningService}: supplies the
 * {@code PODCAST_RSS} module key and the {@link SubscriberFeedService} row store.
 */
@Service
@RequiredArgsConstructor
public class SubscriberFeedProvisioningService implements DefaultFeedStore {

    private final SubscriberFeedService subscriberFeedService;
    private final DefaultFeedProvisioningService defaultFeedProvisioningService;

    public void provisionDefaultFeed(Long tenantId, Long userId) {
        defaultFeedProvisioningService.provisionDefaultFeed(FeatureModuleKeys.PODCAST_RSS, tenantId, userId, this);
    }

    public int provisionMissingDefaultFeeds() {
        return defaultFeedProvisioningService.provisionMissingDefaultFeeds(FeatureModuleKeys.PODCAST_RSS, this);
    }

    public int provisionMissingDefaultFeeds(Long tenantId) {
        return defaultFeedProvisioningService.provisionMissingDefaultFeeds(
                FeatureModuleKeys.PODCAST_RSS,
                tenantId,
                this
        );
    }

    @Override
    public boolean hasDefaultFeed(Long tenantId, Long userId) {
        return subscriberFeedService.hasDefaultFeed(tenantId, userId);
    }

    @Override
    public void ensureDefaultFeed(Long tenantId, Long userId) {
        subscriberFeedService.ensureDefaultFeed(tenantId, userId);
    }
}
