package de.pnnit.directwerk.modules.newsletter.access;

import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import java.util.List;
import java.util.Set;

/**
 * Deep module: what articles a subscriber may see on a given feed.
 * RSS snapshot and preview adapters call here.
 */
public interface ArticleFeedAccess {

    List<Article> listEntitledArticles(
            Long tenantId,
            Long userId,
            ArticleFeed feed);

    List<Article> listEntitledArticlesForCategories(
            Long tenantId,
            Long userId,
            Set<Long> activeCategoryIds);

    boolean hasArticleAccess(
            Long tenantId,
            Long userId,
            ArticleFeed feed,
            Article article);
}
