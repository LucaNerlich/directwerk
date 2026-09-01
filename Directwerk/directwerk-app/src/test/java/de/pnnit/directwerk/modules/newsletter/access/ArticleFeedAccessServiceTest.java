package de.pnnit.directwerk.modules.newsletter.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.newsletter.api.ArticleAccessApi;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.feed.ArticleFeed;
import de.pnnit.directwerk.modules.newsletter.service.PublicArticleQueryService;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ArticleFeedAccessServiceTest {

    @Mock
    private PublicArticleQueryService publicArticleQueryService;

    @Mock
    private ArticleAccessApi articleAccessApi;

    @InjectMocks
    private ArticleFeedAccessService articleFeedAccessService;

    @Test
    void listEntitledArticlesExcludesArticlesTheReaderIsNotEntitledToEvenWhenCategoryMatches() {
        Article entitled = article(1L, category(9L));
        Article notEntitled = article(2L, category(9L));
        when(publicArticleQueryService.listPublishedArticles(10L)).thenReturn(List.of(entitled, notEntitled));
        when(articleAccessApi.filterAccessible(10L, 20L, List.of(entitled, notEntitled)))
                .thenReturn(List.of(entitled));
        ArticleFeed feed = feed(true);

        List<Article> result = articleFeedAccessService.listEntitledArticles(10L, 20L, feed);

        assertThat(result).containsExactly(entitled);
    }

    @Test
    void listEntitledArticlesAppliesCategoryFilterAfterEntitlementFilter() {
        Article entitledMatchingCategory = article(1L, category(9L));
        Article entitledOtherCategory = article(2L, category(5L));
        when(publicArticleQueryService.listPublishedArticles(10L))
                .thenReturn(List.of(entitledMatchingCategory, entitledOtherCategory));
        when(articleAccessApi.filterAccessible(10L, 20L, List.of(entitledMatchingCategory, entitledOtherCategory)))
                .thenReturn(List.of(entitledMatchingCategory, entitledOtherCategory));
        ArticleFeed feed = feed(false, category(9L));

        List<Article> result = articleFeedAccessService.listEntitledArticles(10L, 20L, feed);

        assertThat(result).containsExactly(entitledMatchingCategory);
    }

    @Test
    void listEntitledArticlesForCategoriesOnlyReturnsEntitledArticlesMatchingGivenCategories() {
        Article entitled = article(1L, category(9L));
        Article notEntitled = article(2L, category(9L));
        when(publicArticleQueryService.listPublishedArticles(10L)).thenReturn(List.of(entitled, notEntitled));
        when(articleAccessApi.filterAccessible(10L, 20L, List.of(entitled, notEntitled)))
                .thenReturn(List.of(entitled));

        List<Article> result = articleFeedAccessService.listEntitledArticlesForCategories(10L, 20L, Set.of(9L));

        assertThat(result).containsExactly(entitled);
    }

    @Test
    void hasArticleAccessRequiresBothCategoryMatchAndEntitlement() {
        Article article = article(1L, category(9L));
        ArticleFeed feed = feed(false, category(9L));
        when(articleAccessApi.hasAccess(10L, 20L, 1L)).thenReturn(true);

        assertThat(articleFeedAccessService.hasArticleAccess(10L, 20L, feed, article)).isTrue();
    }

    @Test
    void hasArticleAccessDeniesWhenCategoryDoesNotMatchEvenIfEntitled() {
        Article article = article(1L, category(9L));
        ArticleFeed feed = feed(false, category(5L));

        assertThat(articleFeedAccessService.hasArticleAccess(10L, 20L, feed, article)).isFalse();
    }

    private static ArticleFeed feed(boolean defaultFeed, Category... categories) {
        ArticleFeed feed = new ArticleFeed();
        feed.setDefaultFeed(defaultFeed);
        for (Category category : categories) {
            feed.getCategories().add(category);
        }
        return feed;
    }

    private static Article article(long id, Category... categories) {
        Article article = new Article();
        article.setId(id);
        for (Category category : categories) {
            article.getCategories().add(category);
        }
        return article;
    }

    private static Category category(long id) {
        Category category = new Category();
        category.setId(id);
        category.setActive(true);
        return category;
    }
}
