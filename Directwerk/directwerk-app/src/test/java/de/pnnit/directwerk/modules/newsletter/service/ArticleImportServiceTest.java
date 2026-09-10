package de.pnnit.directwerk.modules.newsletter.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.api.RemoteAssetIngestApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.net.RemoteContentClient;
import de.pnnit.directwerk.modules.digital.service.PublicCdnUrlResolver;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.importrss.ArticleRssFeedParser;
import de.pnnit.directwerk.modules.newsletter.importrss.ParsedArticleRssFeed;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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

    @Test
    void previewUsesBatchImportIdentityLookup() throws Exception {
        String feedUrl = "https://example.com/feed.xml";
        byte[] xml = "<rss/>".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        when(remoteContentClient.get(any(java.net.URI.class), any())).thenReturn(
                new RemoteContentClient.RemoteResponse(
                        java.net.URI.create(feedUrl),
                        200,
                        "application/rss+xml",
                        (long) xml.length,
                        new java.io.ByteArrayInputStream(xml)
                )
        );
        when(articleRssFeedParser.parse(any(), any())).thenReturn(new ParsedArticleRssFeed(
                feedUrl,
                new ParsedArticleRssFeed.Channel("Blog", null, "de", null, null),
                List.of(
                        new ParsedArticleRssFeed.Item("g1", "One", "<p>a</p>", null, null, null),
                        new ParsedArticleRssFeed.Item("g2", "Two", "<p>b</p>", null, null, null)
                )
        ));
        String identity1 = ArticleImportService.importIdentity(feedUrl, "g1");
        String identity2 = ArticleImportService.importIdentity(feedUrl, "g2");
        ArticleRepository.ImportIdentityId existing = new ArticleRepository.ImportIdentityId() {
            @Override
            public String getImportIdentity() {
                return identity1;
            }

            @Override
            public Long getId() {
                return 42L;
            }
        };
        when(articleRepository.findIdsByTenantIdAndImportIdentityIn(eq(10L), any()))
                .thenReturn(List.of(existing));

        ArticleImportService.Preview preview = service.preview(feedUrl);

        verify(articleRepository).findIdsByTenantIdAndImportIdentityIn(
                eq(10L),
                eq(List.of(identity1, identity2))
        );
        verify(articleRepository, never()).findByTenantIdAndImportIdentity(any(), any());
        assertThat(preview.articles().get(0).alreadyImportedArticleId()).isEqualTo(42L);
        assertThat(preview.articles().get(1).alreadyImportedArticleId()).isNull();
    }

    @Test
    void rewritesOnlyImgSrcAndPreservesMatchingHref() throws Exception {
        String feedUrl = "https://example.com/feed.xml";
        String identity = ArticleImportService.importIdentity(feedUrl, "guid-img");
        when(articleRepository.findByTenantIdAndImportIdentity(10L, identity)).thenReturn(Optional.empty());

        MediaAsset asset = new MediaAsset();
        asset.setId(77L);
        when(remoteAssetIngestApi.ingestFromUrl(any())).thenReturn(asset);
        when(publicCdnUrlResolver.resolve(asset)).thenReturn(Optional.of(URI.create("https://cdn.example.com/a.jpg").toURL()));

        Article created = new Article();
        created.setId(1L);
        when(articleService.createImportedDraft(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()
        )).thenReturn(created);
        when(articleRepository.existsByTenantIdAndSlug(10L, "title")).thenReturn(false);

        String source = "https://origin.example.com/pic.jpg";
        String body = "<p><a href=\"" + source + "\">cap</a><img src=\"" + source + "\"/></p>";
        service.importArticle(new ArticleImportService.ImportArticleCommand(
                feedUrl,
                "guid-img",
                "title",
                "Title",
                body,
                null,
                AccessPolicy.FREE,
                null,
                Set.of(),
                null,
                null,
                false,
                true,
                null
        ));

        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(articleService).createImportedDraft(
                eq(10L), any(), any(), bodyCaptor.capture(), any(), any(), any(), any(), any(), any(), any()
        );
        String rewritten = bodyCaptor.getValue();
        assertThat(rewritten).contains("href=\"" + source + "\"");
        assertThat(rewritten).contains("src=\"https://cdn.example.com/a.jpg\"");
        assertThat(rewritten).doesNotContain("src=\"" + source + "\"");
    }

    @Test
    void discardsInlineAssetWhenCdnResolveEmpty() {
        String feedUrl = "https://example.com/feed.xml";
        String identity = ArticleImportService.importIdentity(feedUrl, "guid-empty-cdn");
        when(articleRepository.findByTenantIdAndImportIdentity(10L, identity)).thenReturn(Optional.empty());

        MediaAsset asset = new MediaAsset();
        asset.setId(88L);
        when(remoteAssetIngestApi.ingestFromUrl(any())).thenReturn(asset);
        when(publicCdnUrlResolver.resolve(asset)).thenReturn(Optional.empty());

        Article created = new Article();
        created.setId(2L);
        when(articleService.createImportedDraft(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()
        )).thenReturn(created);
        when(articleRepository.existsByTenantIdAndSlug(10L, "title")).thenReturn(false);

        service.importArticle(new ArticleImportService.ImportArticleCommand(
                feedUrl,
                "guid-empty-cdn",
                "title",
                "Title",
                "<img src=\"https://origin.example.com/pic.jpg\"/>",
                null,
                AccessPolicy.FREE,
                null,
                Set.of(),
                null,
                null,
                false,
                true,
                null
        ));

        verify(remoteAssetIngestApi).discard(88L);
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(articleService).createImportedDraft(
                eq(10L), any(), any(), bodyCaptor.capture(), any(), any(), any(), any(), any(), any(), any()
        );
        assertThat(bodyCaptor.getValue()).contains("https://origin.example.com/pic.jpg");
    }

    @Test
    void propagatesDiscardFailureAfterCdnResolveMiss() {
        String feedUrl = "https://example.com/feed.xml";
        String identity = ArticleImportService.importIdentity(feedUrl, "guid-discard-fail");
        when(articleRepository.findByTenantIdAndImportIdentity(10L, identity)).thenReturn(Optional.empty());

        MediaAsset asset = new MediaAsset();
        asset.setId(99L);
        when(remoteAssetIngestApi.ingestFromUrl(any())).thenReturn(asset);
        when(publicCdnUrlResolver.resolve(asset)).thenReturn(Optional.empty());
        doThrow(new IllegalStateException("discard down")).when(remoteAssetIngestApi).discard(99L);

        assertThatThrownBy(() -> service.importArticle(new ArticleImportService.ImportArticleCommand(
                feedUrl,
                "guid-discard-fail",
                "title",
                "Title",
                "<img src=\"https://origin.example.com/pic.jpg\"/>",
                null,
                AccessPolicy.FREE,
                null,
                Set.of(),
                null,
                null,
                false,
                true,
                null
        ))).isInstanceOf(IllegalStateException.class)
                .hasMessage("discard down");
    }
}
