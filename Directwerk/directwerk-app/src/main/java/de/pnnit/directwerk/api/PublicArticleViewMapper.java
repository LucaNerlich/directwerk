package de.pnnit.directwerk.api;

import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.dto.MeArticleView;
import de.pnnit.directwerk.api.dto.PublicArticleView;
import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.api.dto.CategoryView;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Shared Article → API view mapping for public HTTP surfaces.
 */
@Component
@RequiredArgsConstructor
public class PublicArticleViewMapper {

    public PublicArticleView toPublicView(Article article) {
        return new PublicArticleView(
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
                        .sorted(CategoryView.DISPLAY_ORDER)
                        .map(PublicCategoryView::of)
                        .toList()
        );
    }

    public MeArticleView toPortalView(Article article) {
        return new MeArticleView(
                article.getId(),
                article.getSlug(),
                article.getTitle(),
                article.getBody(),
                article.getExcerpt(),
                article.getSeoDescription(),
                article.getHeroAsset() != null ? article.getHeroAsset().getId() : null,
                article.getAccessPolicy().name(),
                article.getRequiredLevelSortOrder(),
                article.getPublishedAt(),
                article.getCategories().stream()
                        .sorted(CategoryView.DISPLAY_ORDER)
                        .map(PublicCategoryView::of)
                        .toList()
        );
    }

}
