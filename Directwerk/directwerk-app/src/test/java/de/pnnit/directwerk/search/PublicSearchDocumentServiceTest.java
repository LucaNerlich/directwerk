package de.pnnit.directwerk.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.dto.PublicSearchDocumentView;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.FeatureModuleKeys;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

@ExtendWith(MockitoExtension.class)
class PublicSearchDocumentServiceTest {

    @Mock
    private SearchDocumentRepository searchDocumentRepository;

    @Mock
    private ArticleRepository articleRepository;

    @Mock
    private EpisodeRepository episodeRepository;

    @Mock
    private EntitlementService entitlementService;

    @Mock
    private ModuleGateService moduleGateService;

    @Mock
    private DirectwerkConfig directwerkConfig;

    private PublicSearchDocumentService service;

    @BeforeEach
    void setUp() {
        service = new PublicSearchDocumentService(
                searchDocumentRepository,
                articleRepository,
                episodeRepository,
                entitlementService,
                moduleGateService,
                directwerkConfig
        );
        lenient().when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.DIGITAL_CONTENT)).thenReturn(true);
        lenient().when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.PODCAST)).thenReturn(true);
        lenient().when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.SUBSCRIPTION)).thenReturn(false);
        lenient().when(moduleGateService.isModuleActive(10L, FeatureModuleKeys.EMAIL_NOTIFY)).thenReturn(true);
        lenient().when(directwerkConfig.isEmailEnabled()).thenReturn(false);
        lenient().when(searchDocumentRepository.findByTenant_IdOrderByTitleAscIdAsc(10L)).thenReturn(List.of(
                document("article", 7L, "PAID", "secret body words", "public teaser", "/articles/paid"),
                document("article", 8L, "FREE", "free body words", "free teaser", "/articles/free"),
                document("episode", 9L, "PAID", "episode secret", "episode teaser", "/episodes/paid"),
                document("product", 4L, "FREE", "Supporter plan", "Supporter plan", "/pricing"),
                document("newsletter_list", 5L, "FREE", "Weekly", "Weekly", "/newsletter/weekly")
        ));
        lenient().when(articleRepository.findByTenantIdAndIdIn(eq(10L), any())).thenReturn(List.of(paidArticle()));
        lenient().when(episodeRepository.findByTenantIdAndIdIn(eq(10L), any())).thenReturn(List.of(paidEpisode()));
    }

    @Test
    void omitsEpisodesWhoseSeriesIsNotPublished() {
        PodcastSeries draftSeries = new PodcastSeries();
        draftSeries.setId(3L);
        draftSeries.setStatus(SeriesStatus.DRAFT);
        Episode orphan = paidEpisode();
        orphan.setSeries(draftSeries);
        when(episodeRepository.findByTenantIdAndIdIn(eq(10L), any())).thenReturn(List.of(orphan));

        List<PublicSearchDocumentView> guest = service.list(10L);

        assertThat(guest).extracting(PublicSearchDocumentView::slug)
                .contains("paid", "free")
                .doesNotContain("episode-paid");
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void guestLowerTierAndHigherTierFeedsDiffer() {
        when(entitlementService.filterAccessibleArticles(eq(10L), eq(2L), any())).thenReturn(Set.of());
        when(entitlementService.filterAccessibleArticles(eq(10L), eq(3L), any())).thenReturn(Set.of(7L));
        when(entitlementService.filterAccessibleEpisodes(eq(10L), eq(2L), any())).thenReturn(Set.of());
        when(entitlementService.filterAccessibleEpisodes(eq(10L), eq(3L), any())).thenReturn(Set.of(9L));

        List<PublicSearchDocumentView> guest = service.list(10L);
        assertThat(plain(guest, "paid")).isEmpty();
        assertThat(excerpt(guest, "paid")).isEqualTo("public teaser");
        assertThat(plain(guest, "free")).isEqualTo("free body words");
        assertThat(plain(guest, "episode-paid")).isEmpty();
        assertThat(excerpt(guest, "episode-paid")).isEqualTo("episode teaser");
        assertThat(guest).extracting(PublicSearchDocumentView::kind)
                .contains("article", "episode")
                .doesNotContain("product", "newsletter_list");
        assertThat(guest).allSatisfy(row -> assertThat(row.plainText()).doesNotContain("<"));

        authenticate(2L);
        List<PublicSearchDocumentView> lower = service.list(10L);
        assertThat(plain(lower, "paid")).isEmpty();
        assertThat(excerpt(lower, "paid")).isEqualTo("public teaser");
        assertThat(plain(lower, "episode-paid")).isEmpty();

        authenticate(3L);
        List<PublicSearchDocumentView> higher = service.list(10L);
        assertThat(plain(higher, "paid")).isEqualTo("secret body words");
        assertThat(plain(higher, "episode-paid")).isEqualTo("episode secret");
        assertThat(plain(higher, "paid")).isNotEqualTo(plain(lower, "paid"));
    }

    private static String plain(List<PublicSearchDocumentView> rows, String slug) {
        return field(rows, slug, PublicSearchDocumentView::plainText);
    }

    private static String excerpt(List<PublicSearchDocumentView> rows, String slug) {
        return field(rows, slug, PublicSearchDocumentView::excerpt);
    }

    private static String field(
            List<PublicSearchDocumentView> rows,
            String slug,
            Function<PublicSearchDocumentView, String> read
    ) {
        String wanted = switch (slug) {
            case "paid" -> "paid";
            case "free" -> "free";
            case "episode-paid" -> "episode-paid";
            default -> slug;
        };
        return rows.stream()
                .filter(row -> wanted.equals(row.slug()))
                .map(read)
                .findFirst()
                .orElseThrow();
    }

    private static void authenticate(long userId) {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                userId, "reader@example.test", "hash", 10L, List.of());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private static SearchDocument document(
            String kind,
            long sourceId,
            String access,
            String plain,
            String excerpt,
            String href
    ) {
        SearchDocument document = new SearchDocument();
        document.setKind(kind);
        document.setSourceId(sourceId);
        document.setTitle(kind + " " + sourceId);
        document.setSlug(kind.equals("episode") ? "episode-paid" : (access.equals("PAID") ? "paid" : "free"));
        if ("product".equals(kind)) {
            document.setSlug("supporter");
        }
        if ("newsletter_list".equals(kind)) {
            document.setSlug("weekly");
        }
        document.setPlainText(plain);
        document.setExcerpt(excerpt);
        document.setHrefPath(href);
        document.setAccess(access);
        return document;
    }

    private static Article paidArticle() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        Article article = new Article();
        article.setId(7L);
        article.setTenant(tenant);
        article.setSlug("paid");
        article.setTitle("Paid");
        article.setAccessPolicy(AccessPolicy.PAID);
        article.setRequiredLevelSortOrder(5);
        article.setStatus(ArticleStatus.PUBLISHED);
        return article;
    }

    private static Episode paidEpisode() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        PodcastSeries series = new PodcastSeries();
        series.setId(3L);
        series.setStatus(SeriesStatus.PUBLISHED);
        Episode episode = new Episode();
        episode.setId(9L);
        episode.setTenant(tenant);
        episode.setSeries(series);
        episode.setSlug("episode-paid");
        episode.setTitle("Paid episode");
        episode.setAccessPolicy(AccessPolicy.PAID);
        episode.setRequiredLevelSortOrder(5);
        episode.setStatus(EpisodeStatus.PUBLISHED);
        return episode;
    }
}
