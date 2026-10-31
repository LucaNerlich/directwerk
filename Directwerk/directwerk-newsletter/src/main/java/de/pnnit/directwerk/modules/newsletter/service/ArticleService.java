package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.content.BulkPublication;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.newsletter.ArticlesModule;
import de.pnnit.directwerk.modules.content.WorkingDraftMaps;
import de.pnnit.directwerk.modules.core.util.FieldConstraints;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.core.util.TitleNormalizer;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterList;
import de.pnnit.directwerk.modules.newsletter.entity.NewsletterListStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleValidationException;
import de.pnnit.directwerk.modules.newsletter.job.ArticleRssFeedRefreshJobProducer;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.security.SecurityUtils;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import de.pnnit.directwerk.modules.core.util.OffsetLimitPageRequest;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ArticleService {

    private static final int MAX_SEO_DESCRIPTION_LENGTH = 512;

    private final ArticleRepository articleRepository;
    private final CategoryService categoryService;
    private final NewsletterListService newsletterListService;
    private final TenantRepository tenantRepository;
    private final MediaAssetQueryApi mediaAssetQueryApi;
    private final HtmlSanitizer htmlSanitizer;
    private final ArticleRssFeedRefreshJobProducer articleRssFeedRefreshScheduler;
    private final MembershipPermissionService permissionService;

    /**
     * Lists all articles for a tenant, ordered by creation time and ID in descending order.
     *
     * @param tenantId the tenant whose articles are retrieved
     * @return the tenant's articles
     */
    @Transactional(readOnly = true)
    public List<Article> listArticles(Long tenantId) {
        return articleRepository.findByTenantIdOrderByCreatedAtDescIdDesc(tenantId);
    }

    /** Paged variant (#310) — see EpisodeService.listEpisodes(Long, int). */
    @Transactional(readOnly = true)
    public List<Article> listArticles(Long tenantId, int limit) {
        return listArticles(tenantId, limit, 0);
    }

    /** Offset variant so a tenant can reach articles past the first page (#733). */
    @Transactional(readOnly = true)
    public List<Article> listArticles(Long tenantId, int limit, int offset) {
        return articleRepository.findByTenantIdOrderByCreatedAtDescIdDesc(
                tenantId, OffsetLimitPageRequest.of(limit, offset));
    }

    @Transactional(readOnly = true)
    public Article requireArticle(Long tenantId, Long articleId) {
        return articleRepository.findByIdAndTenantId(articleId, tenantId)
                .orElseThrow(() -> new ArticleNotFoundException(articleId));
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article createDraft(
            Long tenantId,
            String rawSlug,
            String title,
            String body,
            String excerpt,
            String seoDescription,
            Long heroAssetId,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Set<Long> categoryIds
    ) {
        permissionService.requireArticleAccess(ContentOperation.CREATE, null);
        String slug = SlugNormalizer.normalize(rawSlug);
        if (articleRepository.existsByTenantIdAndSlug(tenantId, slug)) {
            throw new ConflictException(ConflictCodes.ARTICLE_SLUG_EXISTS, "Article slug already exists: " + slug);
        }

        Article article = new Article();
        article.setTenant(tenantRepository.getReferenceById(tenantId));
        article.setCreatedBy(SecurityUtils.currentUserId());
        article.setSlug(slug);
        article.setTitle(TitleNormalizer.normalize(title, "Article"));
        article.setBody(htmlSanitizer.sanitize(body));
        article.setExcerpt(normalizeOptionalText(excerpt));
        article.setSeoDescription(normalizeSeoDescription(seoDescription));
        article.setHeroAsset(resolveHeroAsset(tenantId, heroAssetId));
        article.setAccessPolicy(accessPolicy != null ? accessPolicy : AccessPolicy.FREE);
        article.setRequiredLevelSortOrder(FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder"));
        article.setStatus(ArticleStatus.DRAFT);
        article.getCategories().addAll(categoryService.resolveActiveCategories(tenantId, categoryIds,
                id -> { throw new ArticleValidationException("Category is inactive: " + id); }));
        Article saved = articleRepository.save(article);
        return requireArticle(tenantId, saved.getId());
    }

    /**
     * Creates a draft article associated with a validated imported-article identity.
     *
     * @param importIdentity a lowercase 64-character hexadecimal SHA-256 digest identifying the imported article
     */
    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article createImportedDraft(
            Long tenantId,
            String rawSlug,
            String title,
            String body,
            String excerpt,
            Long heroAssetId,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Set<Long> categoryIds,
            String importIdentity,
            Instant publishedAt
    ) {
        if (importIdentity == null || !importIdentity.matches("[a-f0-9]{64}")) {
            throw new ArticleValidationException("importIdentity must be a lowercase SHA-256 digest");
        }
        permissionService.requireArticleAccess(ContentOperation.CREATE, null);
        String slug = SlugNormalizer.normalize(rawSlug);
        if (articleRepository.existsByTenantIdAndSlug(tenantId, slug)) {
            throw new ConflictException(ConflictCodes.ARTICLE_SLUG_EXISTS, "Article slug already exists: " + slug);
        }

        Article article = new Article();
        article.setTenant(tenantRepository.getReferenceById(tenantId));
        article.setCreatedBy(SecurityUtils.currentUserId());
        article.setSlug(slug);
        article.setImportIdentity(importIdentity);
        article.setTitle(TitleNormalizer.normalize(title, "Article"));
        article.setBody(htmlSanitizer.sanitize(body));
        article.setExcerpt(normalizeOptionalText(excerpt));
        article.setHeroAsset(resolveHeroAsset(tenantId, heroAssetId));
        article.setAccessPolicy(accessPolicy != null ? accessPolicy : AccessPolicy.FREE);
        article.setRequiredLevelSortOrder(FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder"));
        article.setStatus(ArticleStatus.DRAFT);
        if (publishedAt != null) {
            article.setPublishedAt(publishedAt);
        }
        article.getCategories().addAll(categoryService.resolveActiveCategories(tenantId, categoryIds,
                id -> { throw new ArticleValidationException("Category is inactive: " + id); }));
        Article saved = articleRepository.save(article);
        return requireArticle(tenantId, saved.getId());
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article updateDraft(
            Long tenantId,
            Long articleId,
            String rawSlug,
            String title,
            String body,
            String excerpt,
            String seoDescription,
            Long heroAssetId,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Boolean clearHeroAsset
    ) {
        Article article = requireEditableArticle(tenantId, articleId);
        permissionService.requireArticleAccess(ContentOperation.UPDATE, article.getCreatedBy());
        if (article.getStatus() == ArticleStatus.PUBLISHED) {
            return patchWorkingDraft(
                    tenantId,
                    article,
                    rawSlug,
                    title,
                    body,
                    excerpt,
                    seoDescription,
                    heroAssetId,
                    accessPolicy,
                    requiredLevelSortOrder,
                    clearHeroAsset,
                    null,
                    null);
        }
        applyLiveFieldUpdates(
                tenantId,
                article,
                rawSlug,
                title,
                body,
                excerpt,
                seoDescription,
                heroAssetId,
                accessPolicy,
                requiredLevelSortOrder,
                clearHeroAsset);
        articleRepository.save(article);
        return requireArticle(tenantId, articleId);
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article replaceCategories(Long tenantId, Long articleId, Set<Long> categoryIds) {
        Article article = requireEditableArticle(tenantId, articleId);
        permissionService.requireArticleAccess(ContentOperation.UPDATE, article.getCreatedBy());
        Set<Category> resolved = categoryService.resolveActiveCategories(tenantId, categoryIds,
                id -> { throw new ArticleValidationException("Category is inactive: " + id); });
        if (article.getStatus() == ArticleStatus.PUBLISHED) {
            List<Long> ids = resolved.stream().map(Category::getId).sorted().toList();
            return patchWorkingDraft(
                    tenantId, article, null, null, null, null, null, null, null, null, null, ids, null);
        }
        article.getCategories().clear();
        article.getCategories().addAll(resolved);
        articleRepository.save(article);
        return requireArticle(tenantId, articleId);
    }

    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public Article replaceNewsletterLists(Long tenantId, Long articleId, Set<Long> listIds) {
        Article article = requireEditableArticle(tenantId, articleId);
        permissionService.requireArticleAccess(ContentOperation.UPDATE, article.getCreatedBy());
        List<NewsletterList> resolved = resolveActiveNewsletterLists(tenantId, listIds);
        if (article.getStatus() == ArticleStatus.PUBLISHED) {
            List<Long> ids = resolved.stream().map(NewsletterList::getId).sorted().toList();
            return patchWorkingDraft(
                    tenantId, article, null, null, null, null, null, null, null, null, null, null, ids);
        }
        article.getNewsletterLists().clear();
        article.getNewsletterLists().addAll(resolved);
        articleRepository.save(article);
        return requireArticle(tenantId, articleId);
    }

    /**
     * Whether notify/preview should treat this article as having an ACTIVE audience.
     * Uses the working-draft newsletter-list overlay when present (same as Studio).
     */
    @Transactional(readOnly = true)
    public boolean hasActiveNewsletterAudience(Long tenantId, Article article) {
        Set<Long> effectiveIds = ArticleNewsletterAudience.effectiveListIds(article);
        if (effectiveIds.isEmpty()) {
            return false;
        }
        if (!ArticleNewsletterAudience.hasDraftListOverlay(article)) {
            return article.getNewsletterLists().stream()
                    .anyMatch(list -> list.getStatus() == NewsletterListStatus.ACTIVE);
        }
        for (Long listId : effectiveIds) {
            if (newsletterListService.findList(tenantId, listId)
                    .filter(list -> list.getStatus() == NewsletterListStatus.ACTIVE)
                    .isPresent()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Applies a working-draft overlay onto live columns and join tables. Used by over-publish
     * and by unpublish (so staged edits are not discarded when withdrawing).
     */
    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public void applyWorkingDraft(Long tenantId, Article article) {
        Map<String, Object> draft = article.getWorkingDraft();
        if (!WorkingDraftMaps.isPresent(draft)) {
            return;
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.SLUG)) {
            String slug = SlugNormalizer.normalize(WorkingDraftMaps.getString(draft, WorkingDraftMaps.SLUG));
            if (articleRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, article.getId())) {
                throw new ConflictException(ConflictCodes.ARTICLE_SLUG_EXISTS, "Article slug already exists: " + slug);
            }
            article.setSlug(slug);
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.TITLE)) {
            article.setTitle(TitleNormalizer.normalize(
                    WorkingDraftMaps.getString(draft, WorkingDraftMaps.TITLE), "Article"));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.BODY)) {
            article.setBody(htmlSanitizer.sanitize(WorkingDraftMaps.getString(draft, WorkingDraftMaps.BODY)));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.EXCERPT)) {
            article.setExcerpt(normalizeOptionalText(WorkingDraftMaps.getString(draft, WorkingDraftMaps.EXCERPT)));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.SEO_DESCRIPTION)) {
            article.setSeoDescription(normalizeSeoDescription(
                    WorkingDraftMaps.getString(draft, WorkingDraftMaps.SEO_DESCRIPTION)));
        }
        if (WorkingDraftMaps.getBoolean(draft, WorkingDraftMaps.CLEAR_HERO_ASSET, false)) {
            article.setHeroAsset(null);
        } else if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.HERO_ASSET_ID)) {
            article.setHeroAsset(resolveHeroAsset(
                    tenantId, WorkingDraftMaps.getLong(draft, WorkingDraftMaps.HERO_ASSET_ID)));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.ACCESS_POLICY)) {
            article.setAccessPolicy(AccessPolicy.valueOf(
                    WorkingDraftMaps.getString(draft, WorkingDraftMaps.ACCESS_POLICY)));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER)) {
            article.setRequiredLevelSortOrder(FieldConstraints.requireNonNegative(
                    WorkingDraftMaps.getInteger(draft, WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER),
                    "requiredLevelSortOrder"));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.CATEGORY_IDS)) {
            Set<Long> categoryIds = new LinkedHashSet<>(
                    WorkingDraftMaps.getLongList(draft, WorkingDraftMaps.CATEGORY_IDS));
            article.getCategories().clear();
            article.getCategories().addAll(categoryService.resolveActiveCategories(tenantId, categoryIds,
                    id -> { throw new ArticleValidationException("Category is inactive: " + id); }));
        }
        if (WorkingDraftMaps.containsKey(draft, WorkingDraftMaps.NEWSLETTER_LIST_IDS)) {
            article.getNewsletterLists().clear();
            article.getNewsletterLists().addAll(resolveActiveNewsletterLists(
                    tenantId,
                    new LinkedHashSet<>(WorkingDraftMaps.getLongList(draft, WorkingDraftMaps.NEWSLETTER_LIST_IDS))));
        }
        article.setWorkingDraft(null);
    }

    /**
     * Deletes an article in any status. The tenant-scoped lookup returns 404 for foreign-tenant
     * ids, and the explicit tenant comparison below keeps the delete fail-closed even if the
     * query scoping is ever bypassed. The hero asset is detached, never deleted (the article row
     * owns the reference; S3 objects survive). Category join rows cascade. Custom article feeds
     * reference categories, never article ids, so no feed rules need cleanup; the refresh below
     * rebuilds the public snapshots when the deleted article was visible.
     */
    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public void deleteArticle(Long tenantId, Long articleId) {
        Article article = requireArticle(tenantId, articleId);
        if (article.getTenant() == null || !tenantId.equals(article.getTenant().getId())) {
            throw new ArticleNotFoundException(articleId);
        }
        permissionService.requireArticleAccess(ContentOperation.DELETE, article.getCreatedBy());
        boolean wasVisible = article.getStatus() == ArticleStatus.PUBLISHED
                || article.getStatus() == ArticleStatus.SCHEDULED;
        articleRepository.delete(article);
        if (wasVisible) {
            articleRssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        }
    }

    /**
     * Deletes every id in a single transaction with at most one RSS refresh.
     * Atomic: the first failure (unknown id, cross-tenant id, denied access)
     * rolls back all deletes. Returns the deleted ids in request order
     * (duplicates removed).
     */
    @Transactional
    @RequiresModule(ArticlesModule.KEY)
    public List<Long> bulkDelete(Long tenantId, List<Long> articleIds) {
        List<Long> deleted = new ArrayList<>();
        boolean anyVisible = false;
        for (Long articleId : BulkPublication.distinctIds(articleIds)) {
            Article article = requireArticle(tenantId, articleId);
            if (article.getTenant() == null || !tenantId.equals(article.getTenant().getId())) {
                throw new ArticleNotFoundException(articleId);
            }
            permissionService.requireArticleAccess(ContentOperation.DELETE, article.getCreatedBy());
            anyVisible = anyVisible
                    || article.getStatus() == ArticleStatus.PUBLISHED
                    || article.getStatus() == ArticleStatus.SCHEDULED;
            articleRepository.delete(article);
            deleted.add(articleId);
        }
        if (anyVisible) {
            articleRssFeedRefreshScheduler.requestRefreshAfterCommit(tenantId);
        }
        return deleted;
    }

    private Article requireEditableArticle(Long tenantId, Long articleId) {
        Article article = requireArticle(tenantId, articleId);
        ArticleStatus status = article.getStatus();
        if (status != ArticleStatus.DRAFT && status != ArticleStatus.PUBLISHED) {
            throw new ArticleValidationException(
                    "Only DRAFT or PUBLISHED articles can be edited");
        }
        return article;
    }

    private Article patchWorkingDraft(
            Long tenantId,
            Article article,
            String rawSlug,
            String title,
            String body,
            String excerpt,
            String seoDescription,
            Long heroAssetId,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Boolean clearHeroAsset,
            List<Long> categoryIds,
            List<Long> newsletterListIds
    ) {
        Map<String, Object> draft = WorkingDraftMaps.isPresent(article.getWorkingDraft())
                ? WorkingDraftMaps.mutableCopy(article.getWorkingDraft())
                : seedWorkingDraft(article);
        if (rawSlug != null) {
            String slug = SlugNormalizer.normalize(rawSlug);
            if (articleRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, article.getId())) {
                throw new ConflictException(ConflictCodes.ARTICLE_SLUG_EXISTS, "Article slug already exists: " + slug);
            }
            WorkingDraftMaps.putString(draft, WorkingDraftMaps.SLUG, slug);
        }
        if (title != null) {
            WorkingDraftMaps.putString(
                    draft, WorkingDraftMaps.TITLE, TitleNormalizer.normalize(title, "Article"));
        }
        if (body != null) {
            WorkingDraftMaps.putString(draft, WorkingDraftMaps.BODY, htmlSanitizer.sanitize(body));
        }
        if (excerpt != null) {
            WorkingDraftMaps.putString(draft, WorkingDraftMaps.EXCERPT, normalizeOptionalText(excerpt));
        }
        if (seoDescription != null) {
            WorkingDraftMaps.putString(
                    draft, WorkingDraftMaps.SEO_DESCRIPTION, normalizeSeoDescription(seoDescription));
        }
        if (Boolean.TRUE.equals(clearHeroAsset)) {
            WorkingDraftMaps.putBoolean(draft, WorkingDraftMaps.CLEAR_HERO_ASSET, true);
            WorkingDraftMaps.putNullableLong(draft, WorkingDraftMaps.HERO_ASSET_ID, null);
        } else if (heroAssetId != null) {
            resolveHeroAsset(tenantId, heroAssetId);
            WorkingDraftMaps.putBoolean(draft, WorkingDraftMaps.CLEAR_HERO_ASSET, false);
            WorkingDraftMaps.putNullableLong(draft, WorkingDraftMaps.HERO_ASSET_ID, heroAssetId);
        }
        if (accessPolicy != null) {
            WorkingDraftMaps.putString(draft, WorkingDraftMaps.ACCESS_POLICY, accessPolicy.name());
        }
        if (requiredLevelSortOrder != null) {
            WorkingDraftMaps.putInteger(
                    draft,
                    WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER,
                    FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder"));
        }
        if (categoryIds != null) {
            WorkingDraftMaps.putLongList(draft, WorkingDraftMaps.CATEGORY_IDS, categoryIds);
        }
        if (newsletterListIds != null) {
            WorkingDraftMaps.putLongList(draft, WorkingDraftMaps.NEWSLETTER_LIST_IDS, newsletterListIds);
        }
        article.setWorkingDraft(draft);
        articleRepository.save(article);
        return requireArticle(tenantId, article.getId());
    }

    private Map<String, Object> seedWorkingDraft(Article article) {
        Map<String, Object> draft = WorkingDraftMaps.mutableCopy(null);
        WorkingDraftMaps.putString(draft, WorkingDraftMaps.SLUG, article.getSlug());
        WorkingDraftMaps.putString(draft, WorkingDraftMaps.TITLE, article.getTitle());
        WorkingDraftMaps.putString(draft, WorkingDraftMaps.BODY, article.getBody());
        WorkingDraftMaps.putString(draft, WorkingDraftMaps.EXCERPT, article.getExcerpt());
        WorkingDraftMaps.putString(draft, WorkingDraftMaps.SEO_DESCRIPTION, article.getSeoDescription());
        WorkingDraftMaps.putNullableLong(
                draft,
                WorkingDraftMaps.HERO_ASSET_ID,
                article.getHeroAsset() != null ? article.getHeroAsset().getId() : null);
        WorkingDraftMaps.putBoolean(draft, WorkingDraftMaps.CLEAR_HERO_ASSET, false);
        WorkingDraftMaps.putString(draft, WorkingDraftMaps.ACCESS_POLICY, article.getAccessPolicy().name());
        WorkingDraftMaps.putInteger(
                draft, WorkingDraftMaps.REQUIRED_LEVEL_SORT_ORDER, article.getRequiredLevelSortOrder());
        WorkingDraftMaps.putLongList(
                draft,
                WorkingDraftMaps.CATEGORY_IDS,
                article.getCategories().stream().map(Category::getId).sorted().collect(Collectors.toList()));
        WorkingDraftMaps.putLongList(
                draft,
                WorkingDraftMaps.NEWSLETTER_LIST_IDS,
                article.getNewsletterLists().stream()
                        .map(NewsletterList::getId)
                        .sorted()
                        .collect(Collectors.toList()));
        return draft;
    }

    private void applyLiveFieldUpdates(
            Long tenantId,
            Article article,
            String rawSlug,
            String title,
            String body,
            String excerpt,
            String seoDescription,
            Long heroAssetId,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Boolean clearHeroAsset
    ) {
        if (rawSlug != null) {
            String slug = SlugNormalizer.normalize(rawSlug);
            if (articleRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, article.getId())) {
                throw new ConflictException(ConflictCodes.ARTICLE_SLUG_EXISTS, "Article slug already exists: " + slug);
            }
            article.setSlug(slug);
        }
        if (title != null) {
            article.setTitle(TitleNormalizer.normalize(title, "Article"));
        }
        if (body != null) {
            article.setBody(htmlSanitizer.sanitize(body));
        }
        if (excerpt != null) {
            article.setExcerpt(normalizeOptionalText(excerpt));
        }
        if (seoDescription != null) {
            article.setSeoDescription(normalizeSeoDescription(seoDescription));
        }
        if (Boolean.TRUE.equals(clearHeroAsset)) {
            article.setHeroAsset(null);
        } else if (heroAssetId != null) {
            article.setHeroAsset(resolveHeroAsset(tenantId, heroAssetId));
        }
        if (accessPolicy != null) {
            article.setAccessPolicy(accessPolicy);
        }
        if (requiredLevelSortOrder != null) {
            article.setRequiredLevelSortOrder(
                    FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder"));
        }
    }

    private List<NewsletterList> resolveActiveNewsletterLists(Long tenantId, Set<Long> listIds) {
        List<NewsletterList> resolved = new ArrayList<>();
        if (listIds == null) {
            return resolved;
        }
        for (Long listId : listIds) {
            NewsletterList list = newsletterListService.requireList(tenantId, listId);
            if (list.getStatus() != NewsletterListStatus.ACTIVE) {
                throw new ArticleValidationException("Newsletter list is inactive: " + listId);
            }
            resolved.add(list);
        }
        return resolved;
    }

    private MediaAsset resolveHeroAsset(Long tenantId, Long heroAssetId) {
        if (heroAssetId == null) {
            return null;
        }
        MediaAsset asset = mediaAssetQueryApi.findById(heroAssetId)
                .orElseThrow(() -> new MediaAssetNotFoundException(heroAssetId));
        if (!asset.getTenant().getId().equals(tenantId)) {
            throw new MediaAssetNotFoundException(heroAssetId);
        }
        if (asset.getAssetType() != AssetType.IMAGE || asset.getStatus() != AssetStatus.READY) {
            throw new ArticleValidationException("Hero asset must be a READY image");
        }
        return asset;
    }

    private static String normalizeOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static String normalizeSeoDescription(String seoDescription) {
        String normalized = normalizeOptionalText(seoDescription);
        if (normalized != null && normalized.length() > MAX_SEO_DESCRIPTION_LENGTH) {
            throw new ArticleValidationException("seoDescription must be at most " + MAX_SEO_DESCRIPTION_LENGTH + " characters");
        }
        return normalized;
    }

}
