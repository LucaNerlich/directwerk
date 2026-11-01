package de.pnnit.directwerk.search;

import de.pnnit.directwerk.api.dto.PublicSearchDocumentView;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.FeatureModuleKeys;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.newsletter.api.ArticleAccessSubjects;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.entity.ArticleStatus;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.modules.podcast.api.EpisodeAccessSubjects;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.modules.search.SearchKinds;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicSearchDocumentService {

    private final SearchDocumentRepository searchDocumentRepository;
    private final ArticleRepository articleRepository;
    private final EpisodeRepository episodeRepository;
    private final EntitlementService entitlementService;
    private final ModuleGateService moduleGateService;
    private final DirectwerkConfig directwerkConfig;

    public PublicSearchDocumentService(
            SearchDocumentRepository searchDocumentRepository,
            ArticleRepository articleRepository,
            EpisodeRepository episodeRepository,
            EntitlementService entitlementService,
            ModuleGateService moduleGateService,
            DirectwerkConfig directwerkConfig
    ) {
        this.searchDocumentRepository = searchDocumentRepository;
        this.articleRepository = articleRepository;
        this.episodeRepository = episodeRepository;
        this.entitlementService = entitlementService;
        this.moduleGateService = moduleGateService;
        this.directwerkConfig = directwerkConfig;
    }

    @Transactional(readOnly = true)
    public List<PublicSearchDocumentView> list(Long tenantId) {
        boolean articles = moduleGateService.isModuleActive(tenantId, FeatureModuleKeys.DIGITAL_CONTENT);
        boolean episodes = moduleGateService.isModuleActive(tenantId, FeatureModuleKeys.PODCAST);
        boolean products = moduleGateService.isModuleActive(tenantId, FeatureModuleKeys.SUBSCRIPTION);
        boolean lists = moduleGateService.isModuleActive(tenantId, FeatureModuleKeys.EMAIL_NOTIFY)
                && directwerkConfig.isEmailEnabled();

        List<SearchDocument> candidates = searchDocumentRepository.findByTenant_IdOrderByTitleAscIdAsc(tenantId)
                .stream()
                .filter(document -> included(document.getKind(), articles, episodes, products, lists))
                .toList();
        Set<Long> publishedEpisodeIds = publishedEpisodeIds(tenantId, candidates);
        List<SearchDocument> visible = candidates.stream()
                .filter(document -> episodeCatalogAllows(document, publishedEpisodeIds))
                .toList();

        Long userId = readerId(tenantId);
        Set<Long> openArticles = openArticleIds(tenantId, userId, visible);
        Set<Long> openEpisodes = openEpisodeIds(tenantId, userId, visible);
        return visible.stream()
                .map(document -> toView(document, openArticles, openEpisodes))
                .toList();
    }

    /**
     * Same gate as {@code PublicPodcastQueryService.requirePublishedEpisode}: an episode whose
     * series was withdrawn must not appear in search even if a stale index row remains.
     */
    private Set<Long> publishedEpisodeIds(Long tenantId, List<SearchDocument> documents) {
        List<Long> ids = documents.stream()
                .filter(document -> SearchKinds.EPISODE.equals(document.getKind()))
                .map(SearchDocument::getSourceId)
                .toList();
        if (ids.isEmpty()) {
            return Set.of();
        }
        return episodeRepository.findByTenantIdAndIdIn(tenantId, ids).stream()
                .filter(episode -> episode.getStatus() == EpisodeStatus.PUBLISHED
                        && episode.getSeries() != null
                        && episode.getSeries().getStatus() == SeriesStatus.PUBLISHED)
                .map(Episode::getId)
                .collect(Collectors.toSet());
    }

    private static boolean episodeCatalogAllows(SearchDocument document, Set<Long> publishedEpisodeIds) {
        if (!SearchKinds.EPISODE.equals(document.getKind())) {
            return true;
        }
        return publishedEpisodeIds.contains(document.getSourceId());
    }

    private static boolean included(
            String kind,
            boolean articles,
            boolean episodes,
            boolean products,
            boolean lists
    ) {
        return switch (kind) {
            case SearchKinds.ARTICLE -> articles;
            case SearchKinds.EPISODE -> episodes;
            case SearchKinds.PRODUCT -> products;
            case SearchKinds.NEWSLETTER_LIST -> lists;
            default -> false;
        };
    }

    /**
     * Session is optional. A token for another tenant is treated as a guest so paid bodies
     * stay on the caller's own entitlements.
     */
    private static Long readerId(Long tenantId) {
        DirectwerkUserPrincipal principal = SecurityUtils.currentPrincipal();
        if (principal == null || principal.userId() == null || principal.tenantId() == null) {
            return null;
        }
        if (!tenantId.equals(principal.tenantId())) {
            return null;
        }
        return principal.userId();
    }

    private Set<Long> openArticleIds(Long tenantId, Long userId, List<SearchDocument> documents) {
        if (userId == null) {
            return Set.of();
        }
        List<Long> ids = paidSourceIds(documents, SearchKinds.ARTICLE);
        if (ids.isEmpty()) {
            return Set.of();
        }
        Map<Long, EntitlementService.ArticleAccessSubject> subjects = new LinkedHashMap<>();
        for (Article article : articleRepository.findByTenantIdAndIdIn(tenantId, ids)) {
            if (article.getStatus() != ArticleStatus.PUBLISHED) {
                continue;
            }
            subjects.put(article.getId(), ArticleAccessSubjects.toSubject(article));
        }
        if (subjects.isEmpty()) {
            return Set.of();
        }
        return entitlementService.filterAccessibleArticles(tenantId, userId, subjects);
    }

    private Set<Long> openEpisodeIds(Long tenantId, Long userId, List<SearchDocument> documents) {
        if (userId == null) {
            return Set.of();
        }
        List<Long> ids = paidSourceIds(documents, SearchKinds.EPISODE);
        if (ids.isEmpty()) {
            return Set.of();
        }
        Map<Long, EntitlementService.EpisodeAccessSubject> subjects = new LinkedHashMap<>();
        for (Episode episode : episodeRepository.findByTenantIdAndIdIn(tenantId, ids)) {
            if (episode.getStatus() != EpisodeStatus.PUBLISHED) {
                continue;
            }
            subjects.put(episode.getId(), EpisodeAccessSubjects.toSubject(episode));
        }
        if (subjects.isEmpty()) {
            return Set.of();
        }
        return entitlementService.filterAccessibleEpisodes(tenantId, userId, subjects);
    }

    private static List<Long> paidSourceIds(List<SearchDocument> documents, String kind) {
        return documents.stream()
                .filter(document -> kind.equals(document.getKind()) && "PAID".equals(document.getAccess()))
                .map(SearchDocument::getSourceId)
                .toList();
    }

    private static PublicSearchDocumentView toView(
            SearchDocument document,
            Set<Long> openArticles,
            Set<Long> openEpisodes
    ) {
        String excerpt = document.getExcerpt() == null ? "" : document.getExcerpt();
        String stored = document.getPlainText() == null ? "" : document.getPlainText();
        boolean open = canOpen(document, openArticles, openEpisodes);
        // Locked paid rows keep the teaser in excerpt and leave plainText empty,
        // so the client can tell a short body the caller may open from one they cannot.
        return new PublicSearchDocumentView(
                document.getKind(),
                document.getTitle(),
                document.getSlug(),
                excerpt,
                open ? stored : "",
                document.getHrefPath(),
                document.getAccess()
        );
    }

    private static boolean canOpen(
            SearchDocument document,
            Set<Long> openArticles,
            Set<Long> openEpisodes
    ) {
        if (!"PAID".equals(document.getAccess())) {
            return true;
        }
        return switch (document.getKind()) {
            case SearchKinds.ARTICLE -> openArticles.contains(document.getSourceId());
            case SearchKinds.EPISODE -> openEpisodes.contains(document.getSourceId());
            default -> false;
        };
    }
}
