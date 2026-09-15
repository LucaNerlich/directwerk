package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotKind;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotKind.FeedSnapshotLayout;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotKind.PrivateFeed;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotKind.PublicFeed;
import de.pnnit.directwerk.modules.digital.service.FeedSnapshotOrigin;
import de.pnnit.directwerk.modules.digital.storage.FeedSnapshotStateStore;
import de.pnnit.directwerk.modules.newsletter.ArticleFeedBuilderModule;
import de.pnnit.directwerk.modules.newsletter.ArticleRssModule;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedRepository;
import java.net.URI;
import java.util.List;
import lombok.RequiredArgsConstructor;

/**
 * Article facts for {@link de.pnnit.directwerk.modules.digital.service.FeedSnapshotCoordinator}:
 * tenant-level only (articles have no per-series grouping) plus subscriber feeds gated by the
 * article feed builder.
 */
@RequiredArgsConstructor
class ArticleSnapshotKind implements FeedSnapshotKind {

    private static final FeedSnapshotLayout LAYOUT = new FeedSnapshotLayout(
            "public/rss/articles.xml",
            ArticleFeedSnapshotKind.ARTICLE_TENANT.name(),
            null,
            null,
            id -> "private/rss/article-feed-" + id + ".xml",
            ArticleFeedSnapshotKind.ARTICLE_PRIVATE_FEED.name()
    );

    private final ArticleRssFeedService articleRssFeedService;
    private final ArticleFeedRepository articleFeedRepository;

    @Override
    public String label() {
        return "Article RSS";
    }

    @Override
    public String moduleKey() {
        return ArticleRssModule.KEY;
    }

    @Override
    public String feedBuilderModuleKey() {
        return ArticleFeedBuilderModule.KEY;
    }

    @Override
    public FeedSnapshotLayout layout() {
        return LAYOUT;
    }

    @Override
    public PublicFeed tenantFeed(Tenant tenant) {
        return new PublicFeed(
                FeedSnapshotStateStore.TENANT_SUBJECT_ID,
                origin -> articleRssFeedService.buildPublicFeed(tenant, origin.scheme(), origin.host(), origin.port())
        );
    }

    @Override
    public List<PublicFeed> collectionFeeds(Tenant tenant) {
        return List.of();
    }

    @Override
    public List<PrivateFeed> privateFeeds(Tenant tenant) {
        return articleFeedRepository.findByTenantIdOrderByIdAsc(tenant.getId()).stream()
                .map(feed -> new PrivateFeed(
                        feed.getId(),
                        feed.isEnabled(),
                        feed.isDefaultFeed(),
                        origin -> articleRssFeedService.buildPrivateFeed(
                                tenant, feed, origin.scheme(), origin.host(), origin.port()
                        )
                ))
                .toList();
    }

    @Override
    public FeedSnapshotOrigin fallbackOrigin(String studioBaseUrl) {
        if (studioBaseUrl.isBlank()) {
            return new FeedSnapshotOrigin("https", "localhost", 443);
        }
        try {
            String host = URI.create(studioBaseUrl).getHost();
            return new FeedSnapshotOrigin("https", host == null || host.isBlank() ? "localhost" : host, 443);
        } catch (IllegalArgumentException ex) {
            return new FeedSnapshotOrigin("https", "localhost", 443);
        }
    }
}
