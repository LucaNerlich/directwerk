package de.pnnit.directwerk.api;

import de.pnnit.directwerk.api.dto.ArticleView;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.dto.MeArticleView;
import de.pnnit.directwerk.api.dto.PublicArticleView;
import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.api.dto.CategoryView;
import de.pnnit.directwerk.modules.digital.service.PublicCdnUrlResolver;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import java.util.Comparator;
import java.util.List;
import java.net.URL;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Shared Article → API view mapping for public and studio HTTP surfaces.
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

    /**
     * Studio article projection. Public heroes get a CDN URL for list thumbnails;
     * private heroes stay {@code null} (editors use media preview).
     */
    public ArticleView toStudioView(Article article) {
        return new ArticleView(
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
                article.getStatus().name(),
                article.getPublishedAt(),
                article.getScheduledAt(),
                article.getEmailNotifiedAt(),
                article.getCategories().stream()
                        .sorted(CategoryView.DISPLAY_ORDER)
                        .map(CategoryView::of)
                        .toList(),
                article.getNewsletterLists().stream()
                        .sorted(Comparator.comparing(NewsletterList::getName, String.CASE_INSENSITIVE_ORDER)
                                .thenComparing(NewsletterList::getId))
                        .map(list -> new ArticleView.NewsletterListTag(
                                list.getId(), list.getSlug(), list.getName()))
                        .toList(),
                article.getCreatedBy(),
                article.getCreatedAt(),
                article.getUpdatedAt()
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
