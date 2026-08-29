package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.digital.service.HtmlSanitizer;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleNotFoundException;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleValidationException;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ArticleServiceTest {

    private static final Long TENANT_ID = 10L;
    private static final Long ARTICLE_ID = 7L;

    @Mock
    private ArticleRepository articleRepository;

    @Mock
    private CategoryService categoryService;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private MediaAssetQueryApi mediaAssetQueryApi;

    @InjectMocks
    private ArticleService articleService;

    private final HtmlSanitizer htmlSanitizer = new HtmlSanitizer();

    @BeforeEach
    void wireSanitizer() {
        articleService = new ArticleService(
                articleRepository,
                categoryService,
                tenantRepository,
                mediaAssetQueryApi,
                htmlSanitizer
        );
    }

    @Test
    void createDraftPersistsSanitizedArticle() {
        Tenant tenant = tenant();
        when(articleRepository.existsByTenantIdAndSlug(TENANT_ID, "hello-world")).thenReturn(false);
        when(tenantRepository.getReferenceById(TENANT_ID)).thenReturn(tenant);
        when(categoryService.resolveActiveCategories(eq(TENANT_ID), eq(Set.of()), any())).thenReturn(Set.of());
        when(articleRepository.save(any(Article.class))).thenAnswer(invocation -> {
            Article article = invocation.getArgument(0);
            article.setId(ARTICLE_ID);
            return article;
        });
        when(articleRepository.findByIdAndTenantId(ARTICLE_ID, TENANT_ID)).thenAnswer(invocation -> {
            Article article = new Article();
            article.setId(ARTICLE_ID);
            article.setTenant(tenant);
            article.setSlug("hello-world");
            article.setTitle("Hello World");
            article.setBody("<p>Hello</p>");
            article.setExcerpt("excerpt");
            article.setSeoDescription("SEO text");
            article.setStatus(ArticleStatus.DRAFT);
            article.setAccessPolicy(AccessPolicy.FREE);
            return Optional.of(article);
        });

        Article created = articleService.createDraft(
                TENANT_ID,
                "hello-world",
                "Hello World",
                "<script>alert(1)</script><p>Hello</p>",
                "  excerpt  ",
                " SEO text ",
                null,
                null,
                null,
                Set.of()
        );

        assertThat(created.getSlug()).isEqualTo("hello-world");
        assertThat(created.getBody()).isEqualTo("<p>Hello</p>");
        assertThat(created.getExcerpt()).isEqualTo("excerpt");
        assertThat(created.getSeoDescription()).isEqualTo("SEO text");
        assertThat(created.getStatus()).isEqualTo(ArticleStatus.DRAFT);
    }

    @Test
    void createDraftRejectsDuplicateSlug() {
        when(articleRepository.existsByTenantIdAndSlug(TENANT_ID, "hello-world")).thenReturn(true);

        assertThatThrownBy(() -> articleService.createDraft(
                TENANT_ID,
                "hello-world",
                "Hello",
                "Body",
                null,
                null,
                null,
                null,
                null,
                Set.of()
        )).isInstanceOf(ConflictException.class);
    }

    @Test
    void createDraftRejectsOverlongSeoDescription() {
        when(articleRepository.existsByTenantIdAndSlug(TENANT_ID, "hello-world")).thenReturn(false);

        assertThatThrownBy(() -> articleService.createDraft(
                TENANT_ID,
                "hello-world",
                "Hello",
                "Body",
                null,
                "x".repeat(513),
                null,
                null,
                null,
                Set.of()
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("seoDescription");
    }

    @Test
    void createDraftRequiresReadyImageHeroAsset() {
        when(articleRepository.existsByTenantIdAndSlug(TENANT_ID, "hello-world")).thenReturn(false);
        MediaAsset audio = mediaAsset(TENANT_ID, AssetType.AUDIO, AssetStatus.READY);
        when(mediaAssetQueryApi.findById(55L)).thenReturn(Optional.of(audio));

        assertThatThrownBy(() -> articleService.createDraft(
                TENANT_ID,
                "hello-world",
                "Hello",
                "Body",
                null,
                null,
                55L,
                null,
                null,
                Set.of()
        )).isInstanceOf(ArticleValidationException.class)
                .hasMessageContaining("READY image");
    }

    @Test
    void createDraftRejectsHeroAssetFromAnotherTenant() {
        when(articleRepository.existsByTenantIdAndSlug(TENANT_ID, "hello-world")).thenReturn(false);
        MediaAsset foreignAsset = mediaAsset(99L, AssetType.IMAGE, AssetStatus.READY);
        when(mediaAssetQueryApi.findById(55L)).thenReturn(Optional.of(foreignAsset));

        assertThatThrownBy(() -> articleService.createDraft(
                TENANT_ID,
                "hello-world",
                "Hello",
                "Body",
                null,
                null,
                55L,
                null,
                null,
                Set.of()
        )).isInstanceOf(MediaAssetNotFoundException.class);
    }

    @Test
    void updateDraftRejectsPublishedArticle() {
        Article published = draftArticle();
        published.setStatus(ArticleStatus.PUBLISHED);
        when(articleRepository.findByIdAndTenantId(ARTICLE_ID, TENANT_ID)).thenReturn(Optional.of(published));

        assertThatThrownBy(() -> articleService.updateDraft(
                TENANT_ID,
                ARTICLE_ID,
                null,
                "New title",
                null,
                null,
                null,
                null,
                null,
                null,
                null
        )).isInstanceOf(ArticleValidationException.class)
                .hasMessageContaining("DRAFT");
    }

    @Test
    void updateDraftCanClearHeroAsset() {
        Article draft = draftArticle();
        draft.setHeroAsset(mediaAsset(TENANT_ID, AssetType.IMAGE, AssetStatus.READY));
        when(articleRepository.findByIdAndTenantId(ARTICLE_ID, TENANT_ID)).thenReturn(Optional.of(draft));
        when(articleRepository.save(draft)).thenReturn(draft);

        Article updated = articleService.updateDraft(
                TENANT_ID,
                ARTICLE_ID,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                true
        );

        assertThat(updated.getHeroAsset()).isNull();
        verify(articleRepository).save(draft);
    }

    @Test
    void requireArticleThrowsWhenMissing() {
        when(articleRepository.findByIdAndTenantId(ARTICLE_ID, TENANT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> articleService.requireArticle(TENANT_ID, ARTICLE_ID))
                .isInstanceOf(ArticleNotFoundException.class);
    }

    private static Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        return tenant;
    }

    private static Article draftArticle() {
        Article article = new Article();
        article.setId(ARTICLE_ID);
        article.setTenant(tenant());
        article.setSlug("hello-world");
        article.setTitle("Hello");
        article.setBody("Body");
        article.setStatus(ArticleStatus.DRAFT);
        article.setAccessPolicy(AccessPolicy.FREE);
        return article;
    }

    private static MediaAsset mediaAsset(Long tenantId, AssetType type, AssetStatus status) {
        MediaAsset asset = new MediaAsset();
        asset.setId(55L);
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        asset.setTenant(tenant);
        asset.setAssetType(type);
        asset.setStatus(status);
        return asset;
    }
}
