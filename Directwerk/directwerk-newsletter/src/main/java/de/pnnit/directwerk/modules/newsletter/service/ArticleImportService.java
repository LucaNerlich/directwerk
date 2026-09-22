package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.api.RemoteAssetIngestApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.importing.FeedImportSupport;
import de.pnnit.directwerk.modules.digital.net.RemoteContentClient;
import de.pnnit.directwerk.modules.digital.service.PublicCdnUrlResolver;
import de.pnnit.directwerk.modules.newsletter.ArticlesModule;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleRssImportException;
import de.pnnit.directwerk.modules.newsletter.importrss.ArticleRssFeedParser;
import de.pnnit.directwerk.modules.newsletter.importrss.ImportSlugSuggester;
import de.pnnit.directwerk.modules.newsletter.importrss.ParsedArticleRssFeed;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.net.URL;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ArticleImportService {

    private static final Duration FEED_TIMEOUT = Duration.ofSeconds(30);
    private static final FeedImportSupport.ImportErrorFactory RSS_IMPORT_ERRORS =
            (status, code, message, cause) -> cause == null
                    ? new ArticleRssImportException(status, code, message)
                    : new ArticleRssImportException(status, code, message, cause);
    // ponytail: hard cap; raise if real feeds need more
    private static final int MAX_INLINE_IMAGES = 25;
    private static final Pattern IMG_SRC = Pattern.compile(
            "<img\\b[^>]*\\bsrc\\s*=\\s*[\"']([^\"']+)[\"']",
            Pattern.CASE_INSENSITIVE
    );

    private final RemoteContentClient remoteContentClient;
    private final RemoteAssetIngestApi remoteAssetIngestApi;
    private final PublicCdnUrlResolver publicCdnUrlResolver;
    private final ArticleRssFeedParser articleRssFeedParser;
    private final ArticleService articleService;
    private final ArticleRepository articleRepository;

    @Transactional(readOnly = true)
    @RequiresModule(ArticlesModule.KEY)
    public Preview preview(String feedUrl) {
        Long tenantId = TenantContext.requireTenantId();
        ParsedArticleRssFeed parsed = fetchAndParse(feedUrl);
        List<String> identities = parsed.items().stream()
                .map(item -> importIdentity(parsed.feedUrl(), item.guid()))
                .toList();
        Map<String, Long> existingByIdentity = new HashMap<>();
        if (!identities.isEmpty()) {
            for (ArticleRepository.ImportIdentityId row : articleRepository.findIdsByTenantIdAndImportIdentityIn(
                    tenantId,
                    identities
            )) {
                existingByIdentity.put(row.getImportIdentity(), row.getId());
            }
        }
        List<PreviewArticle> articles = new ArrayList<>();
        for (ParsedArticleRssFeed.Item item : parsed.items()) {
            String identity = importIdentity(parsed.feedUrl(), item.guid());
            articles.add(new PreviewArticle(
                    item.guid(),
                    item.title(),
                    item.bodyHtml(),
                    item.excerpt(),
                    item.publishedAt(),
                    item.imageUrl(),
                    ImportSlugSuggester.suggest(item.title()),
                    existingByIdentity.get(identity)
            ));
        }
        ParsedArticleRssFeed.Channel channel = parsed.channel();
        return new Preview(
                parsed.feedUrl(),
                new PreviewChannel(
                        channel.title(),
                        channel.description(),
                        channel.language(),
                        channel.imageUrl(),
                        channel.link(),
                        ImportSlugSuggester.suggest(channel.title())
                ),
                articles,
                false
        );
    }

    @RequiresModule(ArticlesModule.KEY)
    public MediaAsset ingestAsset(String sourceUrl, AssetType assetType, AssetVisibility visibility, String filenameHint) {
        return remoteAssetIngestApi.ingestFromUrl(new RemoteAssetIngestApi.IngestCommand(
                sourceUrl,
                assetType,
                visibility,
                filenameHint
        )).asset();
    }

    @RequiresModule(ArticlesModule.KEY)
    public MediaAsset startIngestAsset(
            String sourceUrl,
            AssetType assetType,
            AssetVisibility visibility,
            String filenameHint
    ) {
        return remoteAssetIngestApi.startIngestFromUrl(new RemoteAssetIngestApi.IngestCommand(
                sourceUrl,
                assetType,
                visibility,
                filenameHint
        )).asset();
    }

    private RemoteAssetIngestApi.IngestResult ingestAssetTracked(
            String sourceUrl,
            AssetType assetType,
            AssetVisibility visibility,
            String filenameHint
    ) {
        return remoteAssetIngestApi.ingestFromUrl(new RemoteAssetIngestApi.IngestCommand(
                sourceUrl,
                assetType,
                visibility,
                filenameHint
        ));
    }

    @RequiresModule(ArticlesModule.KEY)
    public ImportedArticle importArticle(ImportArticleCommand command) {
        Long tenantId = TenantContext.requireTenantId();
        String identity = importIdentity(command.feedUrl(), command.guid());
        Optional<Article> existing = articleRepository.findByTenantIdAndImportIdentity(tenantId, identity);
        if (existing.isPresent()) {
            return new ImportedArticle(existing.get(), true);
        }

        List<Long> ingestedAssetIds = new ArrayList<>();
        AccessPolicy accessPolicy = command.accessPolicy() == null ? AccessPolicy.FREE : command.accessPolicy();
        Long heroAssetId = command.heroAssetId();
        String body = command.body() == null ? "" : command.body();
        try {
            if (command.importInlineImages()) {
                BodyRewrite rewritten = rewriteInlineImages(body, command.title(), ingestedAssetIds);
                body = rewritten.body();
            }
            if (heroAssetId == null && command.importHero()
                    && command.imageUrl() != null && !command.imageUrl().isBlank()) {
                RemoteAssetIngestApi.IngestResult hero = ingestAssetTracked(
                        command.imageUrl(),
                        AssetType.IMAGE,
                        AssetVisibility.PUBLIC,
                        importFilenameHint(command.title(), command.imageUrl(), "hero", "jpg")
                );
                heroAssetId = hero.asset().getId();
                if (!hero.reused()) {
                    ingestedAssetIds.add(heroAssetId);
                }
            }

            String slug = uniqueSlug(tenantId, command.slug(), command.title());
            Article article = articleService.createImportedDraft(
                    tenantId,
                    slug,
                    command.title(),
                    body,
                    command.excerpt(),
                    heroAssetId,
                    accessPolicy,
                    command.requiredLevelSortOrder(),
                    command.categoryIds(),
                    identity,
                    command.publishedAt()
            );
            return new ImportedArticle(article, false);
        } catch (DataIntegrityViolationException ex) {
            var importedByOther = articleRepository.findByTenantIdAndImportIdentity(tenantId, identity);
            if (importedByOther.isPresent()) {
                discardIngestedAssets(ingestedAssetIds);
                return new ImportedArticle(importedByOther.get(), true);
            }
            String retrySlug = uniqueSlug(tenantId, command.slug(), command.title());
            try {
                Article article = articleService.createImportedDraft(
                        tenantId,
                        retrySlug,
                        command.title(),
                        body,
                        command.excerpt(),
                        heroAssetId,
                        accessPolicy,
                        command.requiredLevelSortOrder(),
                        command.categoryIds(),
                        identity,
                        command.publishedAt()
                );
                return new ImportedArticle(article, false);
            } catch (DataIntegrityViolationException retryFailure) {
                discardIngestedAssets(ingestedAssetIds);
                return articleRepository.findByTenantIdAndImportIdentity(tenantId, identity)
                        .map(article -> new ImportedArticle(article, true))
                        .orElseThrow(() -> new ArticleRssImportException(
                                409,
                                "ARTICLE_SLUG_EXISTS",
                                "The article slug was claimed concurrently",
                                retryFailure
                        ));
            }
        } catch (RuntimeException ex) {
            discardIngestedAssets(ingestedAssetIds);
            throw ex;
        }
    }

    private BodyRewrite rewriteInlineImages(String body, String title, List<Long> ingestedAssetIds) {
        if (body == null || body.isBlank()) {
            return new BodyRewrite(body == null ? "" : body);
        }
        Matcher matcher = IMG_SRC.matcher(body);
        Map<String, String> srcReplacements = new LinkedHashMap<>();
        LinkedHashSet<String> seenSources = new LinkedHashSet<>();
        while (matcher.find() && srcReplacements.size() < MAX_INLINE_IMAGES) {
            String source = matcher.group(1);
            if (source == null || source.isBlank() || !seenSources.add(source)) {
                continue;
            }
            if (!source.startsWith("http://") && !source.startsWith("https://")) {
                continue;
            }
            Long assetId = null;
            boolean reused = false;
            Optional<URL> cdn = Optional.empty();
            RuntimeException resolveFailure = null;
            try {
                RemoteAssetIngestApi.IngestResult ingest = ingestAssetTracked(
                        source,
                        AssetType.IMAGE,
                        AssetVisibility.PUBLIC,
                        importFilenameHint(title, source, "inline", "jpg")
                );
                assetId = ingest.asset().getId();
                reused = ingest.reused();
                if (!reused) {
                    ingestedAssetIds.add(assetId);
                }
                try {
                    cdn = publicCdnUrlResolver.resolve(ingest.asset());
                } catch (RuntimeException ex) {
                    resolveFailure = ex;
                }
            } catch (RuntimeException ingestFailure) {
                log.warn("Skipping inline image ingest for {}", source, ingestFailure);
                continue;
            }
            if (cdn.isEmpty() || resolveFailure != null) {
                if (!reused) {
                    // Discard failure must propagate so outer cleanup can retry. A reused asset
                    // is never discarded: it may back already-published content.
                    remoteAssetIngestApi.discard(assetId);
                    ingestedAssetIds.remove(assetId);
                }
                if (resolveFailure != null) {
                    log.warn("Skipping inline image after CDN resolve failure for {}", source, resolveFailure);
                }
                continue;
            }
            srcReplacements.put(source, cdn.get().toString());
        }
        matcher = IMG_SRC.matcher(body);
        StringBuilder rewritten = new StringBuilder();
        while (matcher.find()) {
            String source = matcher.group(1);
            String cdnUrl = source == null ? null : srcReplacements.get(source);
            if (cdnUrl == null) {
                matcher.appendReplacement(rewritten, Matcher.quoteReplacement(matcher.group(0)));
                continue;
            }
            String tag = matcher.group(0);
            int srcStart = matcher.start(1) - matcher.start();
            int srcEnd = matcher.end(1) - matcher.start();
            String rewrittenTag = tag.substring(0, srcStart) + cdnUrl + tag.substring(srcEnd);
            matcher.appendReplacement(rewritten, Matcher.quoteReplacement(rewrittenTag));
        }
        matcher.appendTail(rewritten);
        return new BodyRewrite(rewritten.toString());
    }

    private void discardIngestedAssets(List<Long> assetIds) {
        FeedImportSupport.discardIngestedAssets(
                assetIds,
                remoteAssetIngestApi::discard,
                log,
                "unreferenced article RSS import asset"
        );
    }

    private ParsedArticleRssFeed fetchAndParse(String feedUrl) {
        return FeedImportSupport.fetchAndParse(
                remoteContentClient,
                feedUrl,
                FEED_TIMEOUT,
                FeedImportSupport.MAX_FEED_BYTES,
                RSS_IMPORT_ERRORS,
                articleRssFeedParser::parse
        );
    }

    private String uniqueSlug(Long tenantId, String requested, String title) {
        return FeedImportSupport.uniqueSlug(
                tenantId,
                requested,
                title,
                "artikel",
                articleRepository::existsByTenantIdAndSlug,
                () -> new ArticleRssImportException(
                        409,
                        "ARTICLE_SLUG_EXISTS",
                        "Could not allocate a unique article slug"
                )
        );
    }

    private static String importFilenameHint(String title, String url, String fallbackStem, String extension) {
        return FeedImportSupport.importFilenameHint(title, url, fallbackStem, extension, "artikel");
    }

    /**
     * Creates a stable identity for an article imported from an RSS feed.
     *
     * @param feedUrl the RSS feed URL
     * @param guid    the article's feed GUID
     * @return the SHA-256 hexadecimal digest of the canonical feed URL and trimmed GUID
     */
    static String importIdentity(String feedUrl, String guid) {
        return FeedImportSupport.importIdentity(feedUrl, guid, "article", RSS_IMPORT_ERRORS);
    }

    private record BodyRewrite(String body) {
    }

    public record Preview(
            String feedUrl,
            PreviewChannel channel,
            List<PreviewArticle> articles,
            boolean truncated
    ) {
    }

    public record PreviewChannel(
            String title,
            String description,
            String language,
            String imageUrl,
            String link,
            String suggestedSlug
    ) {
    }

    public record PreviewArticle(
            String guid,
            String title,
            String body,
            String excerpt,
            Instant publishedAt,
            String imageUrl,
            String suggestedSlug,
            Long alreadyImportedArticleId
    ) {
    }

    public record ImportArticleCommand(
            String feedUrl,
            String guid,
            String slug,
            String title,
            String body,
            String excerpt,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Set<Long> categoryIds,
            String imageUrl,
            Long heroAssetId,
            boolean importHero,
            boolean importInlineImages,
            Instant publishedAt
    ) {
        public ImportArticleCommand {
            categoryIds = categoryIds == null ? Set.of() : new LinkedHashSet<>(categoryIds);
        }
    }

    public record ImportedArticle(Article article, boolean alreadyImported) {
    }
}
