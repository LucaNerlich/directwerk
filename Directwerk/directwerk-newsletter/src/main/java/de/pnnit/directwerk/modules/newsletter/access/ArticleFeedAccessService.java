package de.pnnit.directwerk.modules.newsletter.access;

import de.pnnit.directwerk.modules.digital.access.AbstractFeedAccessService;
import de.pnnit.directwerk.modules.newsletter.api.ArticleAccessApi;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeedCategoryMatcher;
import de.pnnit.directwerk.modules.newsletter.service.PublicArticleQueryService;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ArticleFeedAccessService
        extends AbstractFeedAccessService<Article, ArticleFeed>
        implements ArticleFeedAccess {

    private final PublicArticleQueryService publicArticleQueryService;
    private final ArticleAccessApi articleAccessApi;

    @Override
    @Transactional(readOnly = true)
    public List<Article> listEntitledArticles(
            Long tenantId,
            Long userId,
            ArticleFeed feed) {
        return listEntitled(tenantId, userId, feed);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Article> listEntitledArticlesForCategories(
            Long tenantId,
            Long userId,
            Set<Long> activeCategoryIds) {
        return listEntitledForSelection(tenantId, userId, activeCategoryIds);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasArticleAccess(
            Long tenantId,
            Long userId,
            ArticleFeed feed,
            Article article) {
        return hasAccess(tenantId, userId, feed, article);
    }

    @Override
    protected List<Article> entitledContent(Long tenantId, Long userId) {
        List<Article> published = publicArticleQueryService.listPublishedArticles(tenantId);
        return articleAccessApi.filterAccessible(tenantId, userId, published);
    }

    @Override
    protected boolean matchesFeed(ArticleFeed feed, Article article) {
        return ArticleFeedCategoryMatcher.includes(feed, article);
    }

    @Override
    protected boolean matchesSelection(Article article, Set<Long> selectionIds) {
        return ArticleFeedCategoryMatcher.articleMatchesSelectedCategories(article, selectionIds);
    }

    @Override
    protected boolean hasContentAccess(Long tenantId, Long userId, Article article) {
        return articleAccessApi.hasAccess(tenantId, userId, article.getId());
    }
}
