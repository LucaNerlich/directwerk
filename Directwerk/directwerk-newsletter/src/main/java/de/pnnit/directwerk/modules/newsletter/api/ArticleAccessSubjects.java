package de.pnnit.directwerk.modules.newsletter.api;

import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import java.util.Set;
import java.util.stream.Collectors;

public final class ArticleAccessSubjects {

    private ArticleAccessSubjects() {
    }

    public static EntitlementService.ArticleAccessSubject toSubject(Article article) {
        Set<Long> categoryIds = article.getCategories().stream()
                .map(Category::getId)
                .collect(Collectors.toUnmodifiableSet());
        return new EntitlementService.ArticleAccessSubject(
                article.getAccessPolicy() == AccessPolicy.FREE,
                article.getRequiredLevelSortOrder() != null ? article.getRequiredLevelSortOrder() : 0,
                categoryIds
        );
    }
}
