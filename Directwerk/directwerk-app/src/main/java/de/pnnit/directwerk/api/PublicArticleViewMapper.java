package de.pnnit.directwerk.api;

import de.pnnit.directwerk.api.dto.ArticleView;
import de.pnnit.directwerk.api.dto.PublicCategoryView;
import de.pnnit.directwerk.api.dto.MeArticleView;
import de.pnnit.directwerk.api.dto.PublicArticleView;
import de.pnnit.directwerk.modules.content.PublicSurfacePolicy;
import de.pnnit.directwerk.modules.content.WorkingDraftMaps;
import de.pnnit.directwerk.api.dto.CategoryView;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.digital.service.PublicCdnUrlResolver;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.service.NewsletterListService;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private final CategoryService categoryService;
    private final NewsletterListService newsletterListService;

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
     * private heroes stay {@code null} (editors use media preview). Working-draft overlays
     * replace editable fields when present.
     */
    public ArticleView toStudioView(Article article) {
        Map<String, Object> draft = article.getWorkingDraft();
        boolean hasDraft = WorkingDraftMaps.isPresent(draft);

        String slug = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.SLUG)
                ? WorkingDraftMaps.getString(draft, WorkingDraftMaps.SLUG)
                : article.getSlug();
        String title = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.TITLE)
                ? WorkingDraftMaps.getString(draft, WorkingDraftMaps.TITLE)
                : article.getTitle();
        String body = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.BODY)
                ? WorkingDraftMaps.getString(draft, WorkingDraftMaps.BODY)
                : article.getBody();
        String excerpt = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.EXCERPT)
                ? WorkingDraftMaps.getString(draft, WorkingDraftMaps.EXCERPT)
                : article.getExcerpt();
        String seoDescription = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.SEO_DESCRIPTION)
                ? WorkingDraftMaps.getString(draft, WorkingDraftMaps.SEO_DESCRIPTION)
                : article.getSeoDescription();
        Long heroAssetId = resolveStudioHeroAssetId(article, draft, hasDraft);
        String accessPolicy = hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.ACCESS_POLICY)
                ? WorkingDraftMaps.getString(draft, WorkingDraftMaps.ACCESS_POLICY)
                : article.getAccessPolicy().name();
        Integer requiredLevelSortOrder =
                hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER)
                        ? WorkingDraftMaps.getInteger(draft, WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER)
                        : article.getRequiredLevelSortOrder();

        return new ArticleView(
                article.getId(),
                slug,
                title,
                body,
                excerpt,
                seoDescription,
                heroAssetId,
                resolvePublicHeroImageUrl(article),
                accessPolicy,
                requiredLevelSortOrder,
                article.getStatus().name(),
                article.getPublishedAt(),
                article.getScheduledAt(),
                article.getEmailNotifiedAt(),
                studioCategories(article, draft, hasDraft),
                studioNewsletterLists(article, draft, hasDraft),
                article.getCreatedBy(),
                article.getCreatedAt(),
                article.getUpdatedAt(),
                hasDraft
        );
    }

    private static Long resolveStudioHeroAssetId(
            Article article, Map<String, Object> draft, boolean hasDraft) {
        if (!hasDraft) {
            return heroAssetId(article);
        }
        if (WorkingDraftMaps.getBoolean(draft, WorkingDraftMaps.CLEAR_HERO_ASSET, false)) {
            return null;
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.HERO_ASSET_ID)) {
            return WorkingDraftMaps.getLong(draft, WorkingDraftMaps.HERO_ASSET_ID);
        }
        return heroAssetId(article);
    }

    private List<CategoryView> studioCategories(
            Article article, Map<String, Object> draft, boolean hasDraft) {
        if (hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.CATEGORY_IDS)) {
            Long tenantId = article.getTenant().getId();
            Set<Long> ids = new LinkedHashSet<>(
                    WorkingDraftMaps.getLongList(draft, WorkingDraftMaps.CATEGORY_IDS));
            return categoryService.resolveActiveCategories(tenantId, ids, id -> { })
                    .stream()
                    .sorted(CategoryView.DISPLAY_ORDER)
                    .map(CategoryView::of)
                    .toList();
        }
        return article.getCategories().stream()
                .sorted(CategoryView.DISPLAY_ORDER)
                .map(CategoryView::of)
                .toList();
    }

    private List<ArticleView.NewsletterListTag> studioNewsletterLists(
            Article article, Map<String, Object> draft, boolean hasDraft) {
        if (hasDraft && WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.NEWSLETTER_LIST_IDS)) {
            Long tenantId = article.getTenant().getId();
            return WorkingDraftMaps.getLongList(draft, WorkingDraftMaps.NEWSLETTER_LIST_IDS).stream()
                    .map(id -> newsletterListService.requireList(tenantId, id))
                    .sorted(Comparator.comparing(NewsletterList::getName, String.CASE_INSENSITIVE_ORDER)
                            .thenComparing(NewsletterList::getId))
                    .map(list -> new ArticleView.NewsletterListTag(
                            list.getId(), list.getSlug(), list.getName()))
                    .toList();
        }
        return article.getNewsletterLists().stream()
                .sorted(Comparator.comparing(NewsletterList::getName, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(NewsletterList::getId))
                .map(list -> new ArticleView.NewsletterListTag(
                        list.getId(), list.getSlug(), list.getName()))
                .toList();
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
