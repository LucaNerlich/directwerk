package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class PublicArticleQueryServiceTest {

    @Mock
    private ArticleRepository articleRepository;

    private PublicArticleQueryService publicArticleQueryService;

    @BeforeEach
    void setUp() {
        publicArticleQueryService = new PublicArticleQueryService(articleRepository);
    }

    @Test
    void listPublishedArticlesPagesIdsInSqlAndKeepsTheirOrder() {
        when(articleRepository.findPublishedIds(any(), any(), any())).thenReturn(List.of(3L, 1L));
        when(articleRepository.findPublicByIds(10L, List.of(3L, 1L)))
                .thenReturn(List.of(article(1L), article(3L)));

        List<Article> result = publicArticleQueryService.listPublishedArticles(10L, 2, 1);

        assertThat(result).extracting(Article::getId).containsExactly(3L, 1L);
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        org.mockito.Mockito.verify(articleRepository)
                .findPublishedIds(org.mockito.ArgumentMatchers.eq(10L),
                        org.mockito.ArgumentMatchers.eq(ArticleStatus.PUBLISHED), page.capture());
        assertThat(page.getValue().getOffset()).isEqualTo(1);
        assertThat(page.getValue().getPageSize()).isEqualTo(2);
    }

    @Test
    void listPublishedArticlesSkipsTheGraphLoadForAnEmptyPage() {
        when(articleRepository.findPublishedIds(any(), any(), any())).thenReturn(List.of());

        assertThat(publicArticleQueryService.listPublishedArticles(10L, 50, 500)).isEmpty();
        org.mockito.Mockito.verify(articleRepository, org.mockito.Mockito.never())
                .findPublicByIds(any(), any());
    }

    private static Article article(Long id) {
        Article article = new Article();
        article.setId(id);
        return article;
    }
}
