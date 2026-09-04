package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.api.RemoteAssetIngestApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.digital.net.RemoteContentClient;
import de.pnnit.directwerk.modules.digital.net.RemoteUrlValidator;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.exception.RssImportException;
import de.pnnit.directwerk.modules.core.util.SlugNormalizer;
import de.pnnit.directwerk.modules.podcast.importrss.ImportSlugSuggester;
import de.pnnit.directwerk.modules.podcast.importrss.ParsedRssFeed;
import de.pnnit.directwerk.modules.podcast.importrss.RssFeedParser;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PodcastImportService {

    private static final int MAX_FEED_BYTES = 5 * 1024 * 1024;
    private static final Duration FEED_TIMEOUT = Duration.ofSeconds(30);

    private final RemoteContentClient remoteContentClient;
    private final RemoteAssetIngestApi remoteAssetIngestApi;
    private final RssFeedParser rssFeedParser;
    private final EpisodeService episodeService;
    private final EpisodeRepository episodeRepository;

    /**
     * Previews the episodes and channel metadata available from an RSS feed.
     *
     * @param feedUrl the RSS feed URL to preview
     * @return the parsed feed metadata and episode previews, including identifiers for episodes already imported by the tenant
     */
    @Transactional(readOnly = true)
    @RequiresModule(PodcastModule.KEY)
    public Preview preview(String feedUrl) {
        Long tenantId = TenantContext.requireTenantId();
        ParsedRssFeed parsed = fetchAndParse(feedUrl);
        List<PreviewEpisode> episodes = new ArrayList<>();
        for (ParsedRssFeed.Item item : parsed.items()) {
            String importIdentity = importIdentity(parsed.feedUrl(), item.guid());
            Long existingId = episodeRepository.findByTenantIdAndImportIdentity(tenantId, importIdentity)
                    .map(Episode::getId)
                    .orElse(null);
            episodes.add(new PreviewEpisode(
                    item.guid(),
                    item.title(),
                    item.description(),
                    item.publishedAt(),
                    item.durationSeconds(),
                    item.episodeNumber(),
                    item.audioUrl(),
                    item.audioMimeType(),
                    item.audioSizeBytes(),
                    item.imageUrl(),
                    ImportSlugSuggester.suggest(item.title()),
                    existingId
            ));
        }
        ParsedRssFeed.Channel channel = parsed.channel();
        return new Preview(
                parsed.feedUrl(),
                new PreviewChannel(
                        channel.title(),
                        channel.description(),
                        channel.language(),
                        channel.itunesCategory(),
                        channel.imageUrl(),
                        channel.link(),
                        ImportSlugSuggester.suggest(channel.title())
                ),
                episodes,
                false
        );
    }

    /**
     * Ingests a remote asset from the specified URL.
     *
     * @param sourceUrl    the URL of the remote asset
     * @param assetType    the type of asset to ingest
     * @param visibility   the visibility assigned to the ingested asset
     * @param filenameHint the suggested filename for the asset
     * @return the ingested media asset
     */
    @RequiresModule(PodcastModule.KEY)
    public MediaAsset ingestAsset(String sourceUrl, AssetType assetType, AssetVisibility visibility, String filenameHint) {
        return remoteAssetIngestApi.ingestFromUrl(new RemoteAssetIngestApi.IngestCommand(
                sourceUrl,
                assetType,
                visibility,
                filenameHint
        ));
    }

    /**
     * Starts ingesting a remote asset asynchronously and returns the pending asset immediately.
     */
    @RequiresModule(PodcastModule.KEY)
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

    /**
     * Imports an episode into the current tenant as a draft.
     *
     * <p>Returns an existing episode when the feed and GUID were previously imported. Otherwise,
     * optionally ingests the episode audio and cover image, creates the episode with a unique slug,
     * and cleans up newly ingested assets if the import fails.</p>
     *
     * @param command the episode details and import settings
     * @return the imported episode and whether it was already imported
     */
    @RequiresModule(PodcastModule.KEY)
    public ImportedEpisode importEpisode(ImportEpisodeCommand command) {
        Long tenantId = TenantContext.requireTenantId();
        String importIdentity = importIdentity(command.feedUrl(), command.guid());
        var existing = episodeRepository.findByTenantIdAndImportIdentity(tenantId, importIdentity);
        if (existing.isPresent()) {
            return new ImportedEpisode(existing.get(), true);
        }

        List<Long> ingestedAssetIds = new ArrayList<>(2);
        AccessPolicy accessPolicy = command.accessPolicy() == null ? AccessPolicy.FREE : command.accessPolicy();
        Long audioAssetId = command.audioAssetId();
        Long coverAssetId = command.coverAssetId();
        try {
            if (audioAssetId == null && command.audioUrl() != null && !command.audioUrl().isBlank()) {
                MediaAsset audio = ingestAsset(
                        command.audioUrl(),
                        AssetType.AUDIO,
                        AssetVisibility.PRIVATE,
                        importFilenameHint(command.title(), command.audioUrl(), "episode", "mp3")
                );
                audioAssetId = audio.getId();
                ingestedAssetIds.add(audioAssetId);
            }
            if (coverAssetId == null && command.imageUrl() != null && !command.imageUrl().isBlank()) {
                MediaAsset cover = ingestAsset(
                        command.imageUrl(),
                        AssetType.IMAGE,
                        AssetVisibility.PUBLIC,
                        importFilenameHint(command.title(), command.imageUrl(), "cover", "jpg")
                );
                coverAssetId = cover.getId();
                ingestedAssetIds.add(coverAssetId);
            }

            String slug = uniqueSlug(tenantId, command.slug(), command.title());
            Episode episode = episodeService.createImportedDraft(
                    tenantId,
                    command.seriesId(),
                    command.episodeNumber(),
                    slug,
                    command.title(),
                    command.description(),
                    audioAssetId,
                    coverAssetId,
                    command.durationSeconds(),
                    accessPolicy,
                    command.requiredLevelSortOrder(),
                    command.formatIds(),
                    command.categoryIds(),
                    importIdentity,
                    command.publishedAt()
            );
            return new ImportedEpisode(episode, false);
        } catch (DataIntegrityViolationException ex) {
            // A concurrent request may win the unique import-identity race after
            // this request streamed its assets. Never create a duplicate episode.
            var importedByOtherRequest =
                    episodeRepository.findByTenantIdAndImportIdentity(tenantId, importIdentity);
            if (importedByOtherRequest.isPresent()) {
                discardIngestedAssets(ingestedAssetIds);
                return new ImportedEpisode(importedByOtherRequest.get(), true);
            }

            // A different episode may have claimed the selected slug between
            // allocation and commit. Allocate once more while retaining the
            // already-streamed assets.
            String retrySlug = uniqueSlug(tenantId, command.slug(), command.title());
            try {
                Episode episode = episodeService.createImportedDraft(
                        tenantId,
                        command.seriesId(),
                        command.episodeNumber(),
                        retrySlug,
                        command.title(),
                        command.description(),
                        audioAssetId,
                        coverAssetId,
                        command.durationSeconds(),
                        accessPolicy,
                        command.requiredLevelSortOrder(),
                        command.formatIds(),
                        command.categoryIds(),
                        importIdentity,
                        command.publishedAt()
                );
                return new ImportedEpisode(episode, false);
            } catch (DataIntegrityViolationException retryFailure) {
                discardIngestedAssets(ingestedAssetIds);
                return episodeRepository.findByTenantIdAndImportIdentity(tenantId, importIdentity)
                        .map(episode -> new ImportedEpisode(episode, true))
                        .orElseThrow(() -> new RssImportException(
                                409,
                                "EPISODE_SLUG_EXISTS",
                                "The episode slug was claimed concurrently",
                                retryFailure
                        ));
            }
        } catch (RuntimeException ex) {
            discardIngestedAssets(ingestedAssetIds);
            throw ex;
        }
    }

    /**
     * Discards ingested assets in reverse order, continuing cleanup when an asset cannot be discarded.
     *
     * @param assetIds the identifiers of assets to discard
     */
    private void discardIngestedAssets(List<Long> assetIds) {
        for (int i = assetIds.size() - 1; i >= 0; i--) {
            Long assetId = assetIds.get(i);
            try {
                remoteAssetIngestApi.discard(assetId);
            } catch (RuntimeException cleanupFailure) {
                log.warn("Failed to discard unreferenced RSS import asset {}", assetId, cleanupFailure);
            }
        }
    }

    /**
     * Downloads and parses an RSS feed after validating its URL and response content.
     *
     * @param feedUrl the URL of the RSS feed
     * @return the parsed RSS feed
     */
    private ParsedRssFeed fetchAndParse(String feedUrl) {
        URI uri = RemoteUrlValidator.requirePublicHttpUrl(feedUrl);
        try (RemoteContentClient.RemoteResponse remote = remoteContentClient.get(uri, FEED_TIMEOUT)) {
            if (remote.statusCode() < 200 || remote.statusCode() >= 300) {
                throw new RssImportException(
                        400,
                        "RSS_FEED_UNREACHABLE",
                        "RSS feed returned HTTP " + remote.statusCode()
                );
            }
            byte[] xml = readBounded(remote.body(), MAX_FEED_BYTES);
            return rssFeedParser.parse(remote.finalUri().toString(), new ByteArrayInputStream(xml));
        } catch (UploadValidationException ex) {
            throw new RssImportException(400, ex.getCode(), ex.getMessage(), ex);
        } catch (RssImportException ex) {
            throw ex;
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new RssImportException(400, "RSS_FEED_UNREACHABLE", "RSS feed could not be downloaded", ex);
        }
    }

    /**
     * Allocates an unused tenant-scoped slug for an episode.
     *
     * @param tenantId  the tenant that owns the episode
     * @param requested the requested slug, or {@code null} or blank to derive one from the title
     * @param title     the episode title used to derive a slug when no requested slug is provided
     * @return an available episode slug
     * @throws RssImportException if no unique slug is available after 50 attempts
     */
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
            if (!episodeRepository.existsByTenantIdAndSlug(tenantId, candidate)) {
                return candidate;
            }
        }
        throw new RssImportException(409, "EPISODE_SLUG_EXISTS", "Could not allocate a unique episode slug");
    }

    /**
     * Builds an import filename hint: the URL's last path segment when it carries a file
     * extension, otherwise a descriptive stem derived from the episode title. Keeps imported
     * assets from ending up with non-descriptive names such as {@code asset-10_download.bin}.
     *
     * @param title        the episode title used to derive a slug-based stem
     * @param url          the remote asset URL
     * @param fallbackStem the stem used when the title yields no usable slug
     * @param extension    the extension used when the URL segment carries none
     * @return the filename hint for the ingest command
     */
    private static String importFilenameHint(String title, String url, String fallbackStem, String extension) {
        int slash = url.lastIndexOf('/');
        String last = slash >= 0 ? url.substring(slash + 1) : url;
        int query = last.indexOf('?');
        if (query >= 0) {
            last = last.substring(0, query);
        }
        if (last.lastIndexOf('.') > 0) {
            return last;
        }
        String slug = ImportSlugSuggester.suggest(title);
        String stem = "folge".equals(slug) ? fallbackStem : slug;
        return stem + "." + extension;
    }

    /**
     * Reads input content while enforcing a maximum size and rejecting empty input.
     *
     * @param in       the input stream
     * @param maxBytes the maximum number of bytes to read
     * @return the content read from the stream
     * @throws IOException if reading the stream fails
     */
    private static byte[] readBounded(InputStream in, int maxBytes) throws IOException {
        byte[] buffer = new byte[Math.min(16 * 1024, maxBytes)];
        var out = new java.io.ByteArrayOutputStream();
        int read;
        while ((read = in.read(buffer)) >= 0) {
            if (out.size() + read > maxBytes) {
                throw new RssImportException(400, "RSS_FEED_INVALID", "RSS feed is larger than 5 MB");
            }
            out.write(buffer, 0, read);
        }
        if (out.size() == 0) {
            throw new RssImportException(400, "RSS_FEED_INVALID", "RSS feed was empty");
        }
        return out.toByteArray();
    }

    /**
     * Creates a stable identity for an episode imported from an RSS feed.
     *
     * @param feedUrl the RSS feed URL
     * @param guid    the episode's feed GUID
     * @return the SHA-256 hexadecimal digest of the canonical feed URL and trimmed GUID
     */
    static String importIdentity(String feedUrl, String guid) {
        if (feedUrl == null || feedUrl.isBlank() || guid == null || guid.isBlank()) {
            throw new RssImportException(
                    400,
                    "RSS_FEED_INVALID",
                    "feedUrl and guid are required for an episode import"
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

    /**
     * Canonicalizes a public HTTP or HTTPS feed URL for import identity generation.
     *
     * @param feedUrl the feed URL to validate and normalize
     * @return the canonical ASCII representation of the feed URL
     */
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
            throw new RssImportException(400, "RSS_FEED_INVALID", "feedUrl is not valid", ex);
        }
    }

    public record Preview(
            String feedUrl,
            PreviewChannel channel,
            List<PreviewEpisode> episodes,
            boolean truncated
    ) {
    }

    public record PreviewChannel(
            String title,
            String description,
            String language,
            String itunesCategory,
            String imageUrl,
            String link,
            String suggestedSlug
    ) {
    }

    public record PreviewEpisode(
            String guid,
            String title,
            String description,
            Instant publishedAt,
            Integer durationSeconds,
            Integer episodeNumber,
            String audioUrl,
            String audioMimeType,
            Long audioSizeBytes,
            String imageUrl,
            String suggestedSlug,
            Long alreadyImportedEpisodeId
    ) {
    }

    public record ImportEpisodeCommand(
            Long seriesId,
            String feedUrl,
            String guid,
            String slug,
            String title,
            String description,
            Integer episodeNumber,
            Integer durationSeconds,
            AccessPolicy accessPolicy,
            Integer requiredLevelSortOrder,
            Set<Long> formatIds,
            Set<Long> categoryIds,
            String audioUrl,
            String imageUrl,
            Long audioAssetId,
            Long coverAssetId,
            Instant publishedAt
    ) {
        public ImportEpisodeCommand {
            formatIds = formatIds == null ? Set.of() : new LinkedHashSet<>(formatIds);
            categoryIds = categoryIds == null ? Set.of() : new LinkedHashSet<>(categoryIds);
        }
    }

    public record ImportedEpisode(Episode episode, boolean alreadyImported) {
    }
}
