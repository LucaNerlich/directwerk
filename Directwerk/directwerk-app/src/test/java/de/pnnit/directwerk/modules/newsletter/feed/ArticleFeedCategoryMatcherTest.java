package de.pnnit.directwerk.modules.newsletter.feed;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ArticleFeedCategoryMatcherTest {

    @Test
    void defaultFeedIncludesEveryArticleRegardlessOfCategory() {
        ArticleFeed feed = feed(true, category(1L, true));
        Article article = article(category(2L, true));

        assertThat(ArticleFeedCategoryMatcher.includes(feed, article)).isTrue();
    }

    @Test
    void nullFeedIncludesEveryArticle() {
        Article article = article(category(2L, true));

        assertThat(ArticleFeedCategoryMatcher.includes(null, article)).isTrue();
    }

    @Test
    void customFeedIncludesArticleTaggedWithSelectedActiveCategory() {
        ArticleFeed feed = feed(false, category(1L, true));
        Article article = article(category(1L, true));

        assertThat(ArticleFeedCategoryMatcher.includes(feed, article)).isTrue();
    }

    @Test
    void customFeedExcludesArticleWithNoMatchingCategory() {
        ArticleFeed feed = feed(false, category(1L, true));
        Article article = article(category(2L, true));

        assertThat(ArticleFeedCategoryMatcher.includes(feed, article)).isFalse();
    }

    @Test
    void customFeedIgnoresDeactivatedSelectedCategories() {
        ArticleFeed feed = feed(false, category(1L, false));
        Article article = article(category(1L, true));

        assertThat(ArticleFeedCategoryMatcher.includes(feed, article)).isFalse();
    }

    @Test
    void articleMatchesSelectedCategoriesReturnsFalseForEmptySelection() {
        Article article = article(category(1L, true));

        assertThat(ArticleFeedCategoryMatcher.articleMatchesSelectedCategories(article, Set.of())).isFalse();
    }

    private static ArticleFeed feed(boolean defaultFeed, Category... categories) {
        ArticleFeed feed = new ArticleFeed();
        feed.setDefaultFeed(defaultFeed);
        for (Category category : categories) {
            feed.getCategories().add(category);
        }
        return feed;
    }

    private static Article article(Category... categories) {
        Article article = new Article();
        for (Category category : categories) {
            article.getCategories().add(category);
        }
        return article;
    }

    private static Category category(long id, boolean active) {
        Category category = new Category();
        category.setId(id);
        category.setActive(active);
        return category;
    }
}
