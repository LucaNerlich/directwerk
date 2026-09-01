package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.exception.ConflictCodes;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.FieldConstraints;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.core.util.TitleNormalizer;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleValidationException;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ArticleService {

    private static final int MAX_SEO_DESCRIPTION_LENGTH = 512;

    private final ArticleRepository articleRepository;
    private final CategoryService categoryService;
    private final TenantRepository tenantRepository;
    private final MediaAssetQueryApi mediaAssetQueryApi;
    private final HtmlSanitizer htmlSanitizer;

    @Transactional(readOnly = true)
    public List<Article> listArticles(Long tenantId) {
        return articleRepository.findByTenantIdOrderByCreatedAtDescIdDesc(tenantId);
    }

    @Transactional(readOnly = true)
    public Article requireArticle(Long tenantId, Long articleId) {
        return articleRepository.findByIdAndTenantId(articleId, tenantId)
                .orElseThrow(() -> new ArticleNotFoundException(articleId));
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
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
        String slug = SlugNormalizer.normalize(rawSlug);
        if (articleRepository.existsByTenantIdAndSlug(tenantId, slug)) {
            throw new ConflictException(ConflictCodes.ARTICLE_SLUG_EXISTS, "Article slug already exists: " + slug);
        }

        Article article = new Article();
        article.setTenant(tenantRepository.getReferenceById(tenantId));
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

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
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
        Article article = requireDraftArticle(tenantId, articleId);
        if (rawSlug != null) {
            String slug = SlugNormalizer.normalize(rawSlug);
            if (articleRepository.existsByTenantIdAndSlugAndIdNot(tenantId, slug, articleId)) {
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
            article.setRequiredLevelSortOrder(FieldConstraints.requireNonNegative(requiredLevelSortOrder, "requiredLevelSortOrder"));
        }
        articleRepository.save(article);
        return requireArticle(tenantId, articleId);
    }

    @Transactional
    @RequiresModule(DigitalContentModule.KEY)
    public Article replaceCategories(Long tenantId, Long articleId, Set<Long> categoryIds) {
        Article article = requireDraftArticle(tenantId, articleId);
        article.getCategories().clear();
        article.getCategories().addAll(categoryService.resolveActiveCategories(tenantId, categoryIds,
                id -> { throw new ArticleValidationException("Category is inactive: " + id); }));
        articleRepository.save(article);
        return requireArticle(tenantId, articleId);
    }

    private Article requireDraftArticle(Long tenantId, Long articleId) {
        Article article = requireArticle(tenantId, articleId);
        if (article.getStatus() != ArticleStatus.DRAFT) {
            throw new ArticleValidationException("Only DRAFT articles can be edited");
        }
        return article;
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
