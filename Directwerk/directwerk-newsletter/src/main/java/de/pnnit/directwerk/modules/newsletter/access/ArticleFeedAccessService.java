package de.pnnit.directwerk.modules.newsletter.access;

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
public class ArticleFeedAccessService implements ArticleFeedAccess {

    private final PublicArticleQueryService publicArticleQueryService;
    private final ArticleAccessApi articleAccessApi;

    @Override
    @Transactional(readOnly = true)
    public List<Article> listEntitledArticles(
            Long tenantId,
            Long userId,
            ArticleFeed feed) {
        return entitledArticles(tenantId, userId).stream()
                .filter(article -> ArticleFeedCategoryMatcher.includes(feed, article))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Article> listEntitledArticlesForCategories(
            Long tenantId,
            Long userId,
            Set<Long> activeCategoryIds) {
        return entitledArticles(tenantId, userId).stream()
                .filter(article -> ArticleFeedCategoryMatcher.articleMatchesSelectedCategories(article, activeCategoryIds))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasArticleAccess(
            Long tenantId,
            Long userId,
            ArticleFeed feed,
            Article article) {
        return ArticleFeedCategoryMatcher.includes(feed, article)
                && articleAccessApi.hasAccess(tenantId, userId, article.getId());
    }

    private List<Article> entitledArticles(Long tenantId, Long userId) {
        List<Article> published = publicArticleQueryService.listPublishedArticles(tenantId);
        return articleAccessApi.filterAccessible(tenantId, userId, published);
    }
}
