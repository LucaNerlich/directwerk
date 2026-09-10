package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.api.RemoteAssetIngestApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.net.RemoteContentClient;
import de.pnnit.directwerk.modules.digital.service.PublicCdnUrlResolver;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.importrss.ArticleRssFeedParser;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ArticleImportServiceTest {

    @Mock
    private RemoteContentClient remoteContentClient;
    @Mock
    private RemoteAssetIngestApi remoteAssetIngestApi;
    @Mock
    private PublicCdnUrlResolver publicCdnUrlResolver;
    @Mock
    private ArticleRssFeedParser articleRssFeedParser;
    @Mock
    private ArticleService articleService;
    @Mock
    private ArticleRepository articleRepository;

    private ArticleImportService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(10L);
        service = new ArticleImportService(
                remoteContentClient,
                remoteAssetIngestApi,
                publicCdnUrlResolver,
                articleRssFeedParser,
                articleService,
                articleRepository
        );
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void importIdentityIsStableWithinFeedButDifferentAcrossFeeds() {
        String first = ArticleImportService.importIdentity("https://example.com/one.xml", "article-1");

        assertThat(first).hasSize(64);
        assertThat(ArticleImportService.importIdentity(" https://example.com/one.xml ", " article-1 "))
                .isEqualTo(first);
        assertThat(ArticleImportService.importIdentity("https://example.com/two.xml", "article-1"))
                .isNotEqualTo(first);
    }

    @Test
    void returnsExistingArticleWithoutReimport() {
        String feedUrl = "https://example.com/feed.xml";
        String identity = ArticleImportService.importIdentity(feedUrl, "guid-1");
        Article existing = new Article();
        existing.setId(55L);
        when(articleRepository.findByTenantIdAndImportIdentity(10L, identity)).thenReturn(Optional.of(existing));

        ArticleImportService.ImportedArticle result = service.importArticle(
                new ArticleImportService.ImportArticleCommand(
                        feedUrl,
                        "guid-1",
                        "slug",
                        "Title",
                        "<p>body</p>",
                        null,
                        AccessPolicy.FREE,
                        null,
                        Set.of(),
                        null,
                        null,
                        true,
                        true,
                        null
                )
        );

        assertThat(result.alreadyImported()).isTrue();
        assertThat(result.article().getId()).isEqualTo(55L);
        verify(articleService, never()).createImportedDraft(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()
        );
        verify(remoteAssetIngestApi, never()).ingestFromUrl(any());
    }
}
