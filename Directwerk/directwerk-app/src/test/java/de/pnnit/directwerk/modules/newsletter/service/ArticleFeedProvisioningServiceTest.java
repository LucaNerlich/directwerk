package de.pnnit.directwerk.modules.newsletter.service;

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
class ArticleFeedProvisioningServiceTest {

    @Mock
    private ArticleFeedService articleFeedService;

    @Mock
    private DefaultFeedProvisioningService defaultFeedProvisioningService;

    @InjectMocks
    private ArticleFeedProvisioningService articleFeedProvisioningService;

    @Test
    void provisionDefaultFeedDelegatesWithArticleRssKey() {
        articleFeedProvisioningService.provisionDefaultFeed(10L, 20L);

        verify(defaultFeedProvisioningService).provisionDefaultFeed(
                eq(FeatureModuleKeys.ARTICLE_RSS), eq(10L), eq(20L), any(DefaultFeedStore.class)
        );
    }

    @Test
    void backfillDelegatesWithArticleRssKey() {
        when(defaultFeedProvisioningService.provisionMissingDefaultFeeds(eq(FeatureModuleKeys.ARTICLE_RSS), any()))
                .thenReturn(3);

        assertThat(articleFeedProvisioningService.provisionMissingDefaultFeeds()).isEqualTo(3);
    }

    @Test
    void storeProxiesToArticleFeedService() {
        when(articleFeedService.hasDefaultFeed(10L, 20L)).thenReturn(true);

        assertThat(articleFeedProvisioningService.hasDefaultFeed(10L, 20L)).isTrue();
        articleFeedProvisioningService.ensureDefaultFeed(10L, 20L);

        verify(articleFeedService).ensureDefaultFeed(10L, 20L);
    }
}
