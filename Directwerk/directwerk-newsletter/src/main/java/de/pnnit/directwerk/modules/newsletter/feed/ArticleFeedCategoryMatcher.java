package de.pnnit.directwerk.modules.newsletter.feed;

import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Decides whether an entitled article belongs in a private feed.
 * Default feeds are unfiltered. Custom feeds match when the article is tagged
 * with at least one currently active selected category.
 */
public final class ArticleFeedCategoryMatcher {

    private ArticleFeedCategoryMatcher() {
    }

    public static boolean includes(ArticleFeed feed, Article article) {
        if (feed == null || feed.isDefaultFeed()) {
            return true;
        }
        return articleMatchesSelectedCategories(article, selectedActiveCategoryIds(feed));
    }

    public static boolean articleMatchesSelectedCategories(Article article, Set<Long> activeCategoryIds) {
        if (activeCategoryIds == null || activeCategoryIds.isEmpty() || article == null || article.getCategories() == null) {
            return false;
        }
        return article.getCategories().stream()
                .map(Category::getId)
                .anyMatch(activeCategoryIds::contains);
    }

    public static Set<Long> selectedActiveCategoryIds(ArticleFeed feed) {
        if (feed == null || feed.getCategories() == null) {
            return Set.of();
        }
        return feed.getCategories().stream()
                .filter(Category::isActive)
                .map(Category::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
