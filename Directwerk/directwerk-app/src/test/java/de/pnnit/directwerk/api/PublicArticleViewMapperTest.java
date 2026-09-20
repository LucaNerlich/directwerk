package de.pnnit.directwerk.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.dto.PublicArticleView;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.service.PublicCdnUrlResolver;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import java.net.URI;
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
        return article;
    }
}
