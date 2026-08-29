package de.pnnit.directwerk.api;

import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.controller.publicapi.PublicArticleController;
import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.util.Comparator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Shared Article → API view mapping for public HTTP surfaces.
 */
@Component
@RequiredArgsConstructor
public class PublicArticleViewMapper {

    public PublicArticleController.PublicArticleView toPublicView(Article article) {
        return new PublicArticleController.PublicArticleView(
                article.getId(),
                article.getSlug(),
                article.getTitle(),
                PublicSurfacePolicy.articleBody(article.getBody(), article.getAccessPolicy().name()),
                article.getExcerpt(),
                article.getSeoDescription(),
                article.getHeroAsset() != null ? article.getHeroAsset().getId() : null,
                article.getAccessPolicy().name(),
                article.getRequiredLevelSortOrder(),
                article.getPublishedAt(),
                article.getCategories().stream()
                        .sorted(Comparator.comparing(Category::getName).thenComparing(Category::getId))
                        .map(PublicArticleViewMapper::toCategoryView)
                        .toList()
        );
    }

    private static PublicCategoryView toCategoryView(Category category) {
        return new PublicCategoryView(
                category.getId(),
                category.getSlug(),
                category.getName(),
                category.getParent() != null ? category.getParent().getId() : null
        );
    }
}
