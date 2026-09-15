package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.core.FeatureModuleKeys;
import de.pnnit.directwerk.modules.core.feed.DefaultFeedProvisioningService;
import de.pnnit.directwerk.modules.core.feed.DefaultFeedStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Article adapter over {@link DefaultFeedProvisioningService}: supplies the
 * {@code ARTICLE_RSS} module key and the {@link ArticleFeedService} row store.
 */
@Service
@RequiredArgsConstructor
public class ArticleFeedProvisioningService implements DefaultFeedStore {

    private final ArticleFeedService articleFeedService;
    private final DefaultFeedProvisioningService defaultFeedProvisioningService;

    public void provisionDefaultFeed(Long tenantId, Long userId) {
        defaultFeedProvisioningService.provisionDefaultFeed(FeatureModuleKeys.ARTICLE_RSS, tenantId, userId, this);
    }

    public int provisionMissingDefaultFeeds() {
        return defaultFeedProvisioningService.provisionMissingDefaultFeeds(FeatureModuleKeys.ARTICLE_RSS, this);
    }

    public int provisionMissingDefaultFeeds(Long tenantId) {
        return defaultFeedProvisioningService.provisionMissingDefaultFeeds(
                FeatureModuleKeys.ARTICLE_RSS,
                tenantId,
                this
        );
    }

    @Override
    public boolean hasDefaultFeed(Long tenantId, Long userId) {
        return articleFeedService.hasDefaultFeed(tenantId, userId);
    }

    @Override
    public void ensureDefaultFeed(Long tenantId, Long userId) {
        articleFeedService.ensureDefaultFeed(tenantId, userId);
    }
}
