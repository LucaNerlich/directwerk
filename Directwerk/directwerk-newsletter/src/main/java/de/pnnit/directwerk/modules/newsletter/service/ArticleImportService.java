package de.pnnit.directwerk.modules.newsletter.service;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.digital.api.RemoteAssetIngestApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.digital.net.RemoteContentClient;
import de.pnnit.directwerk.modules.digital.net.RemoteUrlValidator;
import de.pnnit.directwerk.modules.digital.service.MediaUploadRules;
import de.pnnit.directwerk.modules.digital.service.PublicCdnUrlResolver;
import de.pnnit.directwerk.modules.newsletter.ArticlesModule;
import de.pnnit.directwerk.modules.newsletter.entity.Article;
import de.pnnit.directwerk.modules.newsletter.exception.ArticleRssImportException;
import de.pnnit.directwerk.modules.newsletter.importrss.ArticleRssFeedParser;
import de.pnnit.directwerk.modules.newsletter.importrss.ImportSlugSuggester;
import de.pnnit.directwerk.modules.newsletter.importrss.ParsedArticleRssFeed;
import de.pnnit.directwerk.modules.newsletter.repository.ArticleRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
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

    private static final int MAX_FEED_BYTES = 5 * 1024 * 1024;
    private static final Duration FEED_TIMEOUT = Duration.ofSeconds(30);
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
        List<PreviewArticle> articles = new ArrayList<>();
        for (ParsedArticleRssFeed.Item item : parsed.items()) {
            String identity = importIdentity(parsed.feedUrl(), item.guid());
            Long existingId = articleRepository.findByTenantIdAndImportIdentity(tenantId, identity)
                    .map(Article::getId)
                    .orElse(null);
            articles.add(new PreviewArticle(
                    item.guid(),
                    item.title(),
                    item.bodyHtml(),
                    item.excerpt(),
                    item.publishedAt(),
                    item.imageUrl(),
                    ImportSlugSuggester.suggest(item.title()),
                    existingId
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
        ));
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
                MediaAsset hero = ingestAsset(
                        command.imageUrl(),
                        AssetType.IMAGE,
                        AssetVisibility.PUBLIC,
                        importFilenameHint(command.title(), command.imageUrl(), "hero", "jpg")
                );
                heroAssetId = hero.getId();
                ingestedAssetIds.add(heroAssetId);
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
        Map<String, String> replacements = new LinkedHashMap<>();
        while (matcher.find() && replacements.size() < MAX_INLINE_IMAGES) {
            String source = matcher.group(1);
            if (source == null || source.isBlank() || replacements.containsKey(source)) {
                continue;
            }
            if (!source.startsWith("http://") && !source.startsWith("https://")) {
                continue;
            }
            try {
                MediaAsset asset = ingestAsset(
                        source,
                        AssetType.IMAGE,
                        AssetVisibility.PUBLIC,
                        importFilenameHint(title, source, "inline", "jpg")
                );
                ingestedAssetIds.add(asset.getId());
                Optional<URL> cdn = publicCdnUrlResolver.resolve(asset);
                if (cdn.isPresent()) {
                    replacements.put(source, cdn.get().toString());
                }
            } catch (RuntimeException ex) {
                log.warn("Skipping inline image ingest for {}", source, ex);
            }
        }
        String rewritten = body;
        for (Map.Entry<String, String> entry : replacements.entrySet()) {
            rewritten = rewritten.replace(entry.getKey(), entry.getValue());
        }
        return new BodyRewrite(rewritten);
    }

    private void discardIngestedAssets(List<Long> assetIds) {
        for (int i = assetIds.size() - 1; i >= 0; i--) {
            Long assetId = assetIds.get(i);
            try {
                remoteAssetIngestApi.discard(assetId);
            } catch (RuntimeException cleanupFailure) {
                log.warn("Failed to discard unreferenced article RSS import asset {}", assetId, cleanupFailure);
            }
        }
    }

    private ParsedArticleRssFeed fetchAndParse(String feedUrl) {
        URI uri = RemoteUrlValidator.requirePublicHttpUrl(feedUrl);
        try (RemoteContentClient.RemoteResponse remote = remoteContentClient.get(uri, FEED_TIMEOUT)) {
            if (remote.statusCode() < 200 || remote.statusCode() >= 300) {
                throw new ArticleRssImportException(
                        400,
                        "RSS_FEED_UNREACHABLE",
                        "RSS feed returned HTTP " + remote.statusCode()
                );
            }
            byte[] xml = readBounded(remote.body(), MAX_FEED_BYTES);
            return articleRssFeedParser.parse(remote.finalUri().toString(), new ByteArrayInputStream(xml));
        } catch (UploadValidationException ex) {
            throw new ArticleRssImportException(400, ex.getCode(), ex.getMessage(), ex);
        } catch (ArticleRssImportException ex) {
            throw ex;
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new ArticleRssImportException(400, "RSS_FEED_UNREACHABLE", "RSS feed could not be downloaded", ex);
        }
    }

    private String uniqueSlug(Long tenantId, String requested, String title) {
        String base;
        if (requested == null || requested.isBlank()) {
            base = ImportSlugSuggester.suggest(title);
        } else {
            try {
                base = SlugNormalizer.normalize(requested);
            } catch (IllegalArgumentException invalid) {
                base = ImportSlugSuggester.suggest(requested);
            }
        }
        for (int attempt = 1; attempt <= 50; attempt++) {
            String candidate = ImportSlugSuggester.withSuffix(base, attempt);
            if (!articleRepository.existsByTenantIdAndSlug(tenantId, candidate)) {
                return candidate;
            }
        }
        throw new ArticleRssImportException(409, "ARTICLE_SLUG_EXISTS", "Could not allocate a unique article slug");
    }

    private static String importFilenameHint(String title, String url, String fallbackStem, String extension) {
        int slash = url.lastIndexOf('/');
        String last = slash >= 0 ? url.substring(slash + 1) : url;
        int query = last.indexOf('?');
        if (query >= 0) {
            last = last.substring(0, query);
        }
        int dot = last.lastIndexOf('.');
        boolean hasExtension = dot > 0 && dot < last.length() - 1;
        String slug = ImportSlugSuggester.suggest(title);
        if (!"artikel".equals(slug)) {
            return slug + (hasExtension ? last.substring(dot) : "." + extension);
        }
        if (hasExtension && !MediaUploadRules.isGenericFilenameStem(last.substring(0, dot))) {
            return last;
        }
        return fallbackStem + (hasExtension ? last.substring(dot) : "." + extension);
    }

    private static byte[] readBounded(InputStream in, int maxBytes) throws IOException {
        byte[] buffer = new byte[Math.min(16 * 1024, maxBytes)];
        var out = new java.io.ByteArrayOutputStream();
        int read;
        while ((read = in.read(buffer)) >= 0) {
            if (out.size() + read > maxBytes) {
                throw new ArticleRssImportException(400, "RSS_FEED_INVALID", "RSS feed is larger than 5 MB");
            }
            out.write(buffer, 0, read);
        }
        if (out.size() == 0) {
            throw new ArticleRssImportException(400, "RSS_FEED_INVALID", "RSS feed was empty");
        }
        return out.toByteArray();
    }

    static String importIdentity(String feedUrl, String guid) {
        if (feedUrl == null || feedUrl.isBlank() || guid == null || guid.isBlank()) {
            throw new ArticleRssImportException(
                    400,
                    "RSS_FEED_INVALID",
                    "feedUrl and guid are required for an article import"
            );
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] value = (canonicalFeedUrl(feedUrl) + "\n" + guid.trim()).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(digest.digest(value));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private static String canonicalFeedUrl(String feedUrl) {
        try {
            URI parsed = URI.create(feedUrl.trim());
            String scheme = parsed.getScheme();
            String host = parsed.getHost();
            if (scheme == null || host == null || parsed.getUserInfo() != null) {
                throw new IllegalArgumentException("feedUrl must be an absolute public URL");
            }
            String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
            if (!"http".equals(normalizedScheme) && !"https".equals(normalizedScheme)) {
                throw new IllegalArgumentException("feedUrl must use http or https");
            }
            int port = parsed.getPort();
            if (("http".equals(normalizedScheme) && port == 80)
                    || ("https".equals(normalizedScheme) && port == 443)) {
                port = -1;
            }
            String path = parsed.getRawPath();
            if (path == null || path.isBlank()) {
                path = "/";
            }
            return new URI(
                    normalizedScheme,
                    null,
                    host.toLowerCase(Locale.ROOT),
                    port,
                    path,
                    parsed.getRawQuery(),
                    null
            ).normalize().toASCIIString();
        } catch (IllegalArgumentException | URISyntaxException ex) {
            throw new ArticleRssImportException(400, "RSS_FEED_INVALID", "feedUrl is not valid", ex);
        }
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
