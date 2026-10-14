package de.pnnit.directwerk.api;

import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.dto.MeArticleView;
import de.pnnit.directwerk.api.dto.PublicArticleView;
import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.api.dto.CategoryView;
import de.pnnit.directwerk.modules.digital.service.PublicCdnUrlResolver;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.util.List;
import java.net.URL;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Shared Article → API view mapping for public HTTP surfaces.
 */
@Component
@RequiredArgsConstructor
public class PublicArticleViewMapper {

    private final PublicCdnUrlResolver publicCdnUrlResolver;

    // Issue #382: the two views differed only in the body source, so both delegate to one
    // builder — a new field can no longer be added to one and missed in the other.
    public PublicArticleView toPublicView(Article article) {
        return new PublicArticleView(
                article.getId(),
                article.getSlug(),
                article.getTitle(),
                PublicSurfacePolicy.articleBody(article.getBody(), article.getAccessPolicy().name()),
                article.getExcerpt(),
                article.getSeoDescription(),
                heroAssetId(article),
                resolvePublicHeroImageUrl(article),
                article.getAccessPolicy().name(),
                article.getRequiredLevelSortOrder(),
                article.getPublishedAt(),
                categoryViews(article)
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
                heroAssetId(article),
                resolvePublicHeroImageUrl(article),
                article.getAccessPolicy().name(),
                article.getRequiredLevelSortOrder(),
                article.getPublishedAt(),
                categoryViews(article)
        );
    }

    private static Long heroAssetId(Article article) {
        return article.getHeroAsset() != null ? article.getHeroAsset().getId() : null;
    }

    private static List<PublicCategoryView> categoryViews(Article article) {
        return article.getCategories().stream()
                .sorted(CategoryView.DISPLAY_ORDER)
                .map(PublicCategoryView::of)
                .toList();
    }

    private String resolvePublicHeroImageUrl(Article article) {
        if (article.getHeroAsset() == null) {
            return null;
        }
        return publicCdnUrlResolver.resolve(article.getHeroAsset())
                .map(URL::toString)
                .orElse(null);
    }

}
