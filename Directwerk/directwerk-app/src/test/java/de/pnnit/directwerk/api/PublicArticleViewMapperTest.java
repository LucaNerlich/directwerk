package de.pnnit.directwerk.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.dto.ArticleView;
import de.pnnit.directwerk.api.dto.PublicArticleView;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.service.CategoryService;
import de.pnnit.directwerk.modules.digital.service.PublicCdnUrlResolver;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.service.NewsletterListService;
import java.net.URI;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PublicArticleViewMapperTest {

    @Mock
    private PublicCdnUrlResolver publicCdnUrlResolver;

    @Mock
    private CategoryService categoryService;

    @Mock
    private NewsletterListService newsletterListService;

    @InjectMocks
    private PublicArticleViewMapper mapper;

    @Test
    void publicViewExposesPublicHeroImageUrl() throws Exception {
        MediaAsset hero = org.mockito.Mockito.mock(MediaAsset.class);
        when(hero.getId()).thenReturn(9L);
        Article article = article(hero);
        when(publicCdnUrlResolver.resolve(hero))
                .thenReturn(Optional.of(URI.create("https://cdn.test/hero.jpg").toURL()));

        PublicArticleView view = mapper.toPublicView(article);

        assertThat(view.heroAssetId()).isEqualTo(9L);
        assertThat(view.heroImageUrl()).isEqualTo("https://cdn.test/hero.jpg");
    }

    @Test
    void publicViewKeepsPrivateHeroNull() {
        MediaAsset hero = org.mockito.Mockito.mock(MediaAsset.class);
        when(hero.getId()).thenReturn(9L);
        Article article = article(hero);
        when(publicCdnUrlResolver.resolve(hero)).thenReturn(Optional.empty());

        PublicArticleView view = mapper.toPublicView(article);

        assertThat(view.heroAssetId()).isEqualTo(9L);
        assertThat(view.heroImageUrl()).isNull();
    }

    @Test
    void studioViewExposesPublicHeroImageUrlForListThumbs() throws Exception {
        MediaAsset hero = org.mockito.Mockito.mock(MediaAsset.class);
        when(hero.getId()).thenReturn(9L);
        Article article = article(hero);
        when(publicCdnUrlResolver.resolve(hero))
                .thenReturn(Optional.of(URI.create("https://cdn.test/hero.jpg").toURL()));

        ArticleView view = mapper.toStudioView(article);

        assertThat(view.heroAssetId()).isEqualTo(9L);
        assertThat(view.heroImageUrl()).isEqualTo("https://cdn.test/hero.jpg");
        assertThat(view.status()).isEqualTo("DRAFT");
    }

    private static Article article(MediaAsset hero) {
        Article article = org.mockito.Mockito.mock(Article.class);
        when(article.getId()).thenReturn(1L);
        when(article.getSlug()).thenReturn("beitrag");
        when(article.getTitle()).thenReturn("Beitrag");
        when(article.getBody()).thenReturn("<p>Hi</p>");
        when(article.getExcerpt()).thenReturn(null);
        when(article.getSeoDescription()).thenReturn(null);
        when(article.getHeroAsset()).thenReturn(hero);
        when(article.getAccessPolicy()).thenReturn(AccessPolicy.FREE);
        when(article.getRequiredLevelSortOrder()).thenReturn(null);
        when(article.getPublishedAt()).thenReturn(null);
        when(article.getCategories()).thenReturn(Set.of());
        // Studio-only fields — lenient so public-view tests stay strict.
        org.mockito.Mockito.lenient().when(article.getStatus()).thenReturn(ArticleStatus.DRAFT);
        org.mockito.Mockito.lenient().when(article.getScheduledAt()).thenReturn(null);
        org.mockito.Mockito.lenient().when(article.getEmailNotifiedAt()).thenReturn(null);
        org.mockito.Mockito.lenient().when(article.getNewsletterLists()).thenReturn(Set.of());
        org.mockito.Mockito.lenient().when(article.getCreatedBy()).thenReturn(null);
        org.mockito.Mockito.lenient()
                .when(article.getCreatedAt())
                .thenReturn(Instant.parse("2026-01-01T00:00:00Z"));
        org.mockito.Mockito.lenient()
                .when(article.getUpdatedAt())
                .thenReturn(Instant.parse("2026-01-01T00:00:00Z"));
        org.mockito.Mockito.lenient().when(article.getWorkingDraft()).thenReturn(null);
        return article;
    }
}
