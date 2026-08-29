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
import de.pnnit.directwerk.modules.podcast.importrss.ImportSlugSuggester;
import de.pnnit.directwerk.modules.podcast.importrss.ParsedRssFeed;
import de.pnnit.directwerk.modules.podcast.importrss.RssFeedParser;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
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
    private static final int MAX_EPISODES = 500;
    private static final Duration FEED_TIMEOUT = Duration.ofSeconds(30);

    private final RemoteContentClient remoteContentClient;
    private final RemoteAssetIngestApi remoteAssetIngestApi;
    private final RssFeedParser rssFeedParser;
    private final EpisodeService episodeService;
    private final EpisodeRepository episodeRepository;

    @Transactional(readOnly = true)
    @RequiresModule(PodcastModule.KEY)
    public Preview preview(String feedUrl) {
        Long tenantId = TenantContext.requireTenantId();
        ParsedRssFeed parsed = fetchAndParse(feedUrl);
        List<PreviewEpisode> episodes = new ArrayList<>();
        int limit = Math.min(parsed.items().size(), MAX_EPISODES);
        for (int i = 0; i < limit; i++) {
            ParsedRssFeed.Item item = parsed.items().get(i);
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
                parsed.items().size() > MAX_EPISODES
        );
    }

    @RequiresModule(PodcastModule.KEY)
    public MediaAsset ingestAsset(String sourceUrl, AssetType assetType, AssetVisibility visibility, String filenameHint) {
        return remoteAssetIngestApi.ingestFromUrl(new RemoteAssetIngestApi.IngestCommand(
                sourceUrl,
                assetType,
                visibility,
                filenameHint
        ));
    }

    @RequiresModule(PodcastModule.KEY)
    public ImportedEpisode importEpisode(ImportEpisodeCommand command) {
        Long tenantId = TenantContext.requireTenantId();
        String importIdentity = importIdentity(command.feedUrl(), command.guid());
        var existing = episodeRepository.findByTenantIdAndImportIdentity(tenantId, importIdentity);
        if (existing.isPresent()) {
            return new ImportedEpisode(existing.get(), true);
        }

        List<Long> ingestedAssetIds = new ArrayList<>(2);
        try {
            AccessPolicy accessPolicy = command.accessPolicy() == null ? AccessPolicy.FREE : command.accessPolicy();
            Long audioAssetId = null;
            if (command.audioUrl() != null && !command.audioUrl().isBlank()) {
                MediaAsset audio = ingestAsset(
                        command.audioUrl(),
                        AssetType.AUDIO,
                        AssetVisibility.PRIVATE,
                        filenameFromUrl(command.audioUrl(), "episode.mp3")
                );
                audioAssetId = audio.getId();
                ingestedAssetIds.add(audioAssetId);
            }
            Long coverAssetId = command.coverAssetId();
            if (command.imageUrl() != null && !command.imageUrl().isBlank()) {
                MediaAsset cover = ingestAsset(
                        command.imageUrl(),
                        AssetType.IMAGE,
                        AssetVisibility.PUBLIC,
                        filenameFromUrl(command.imageUrl(), "cover.jpg")
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
                    importIdentity
            );
            return new ImportedEpisode(episode, false);
        } catch (DataIntegrityViolationException ex) {
            // A concurrent request may win the unique import-identity race after
            // this request streamed its assets. Never create a duplicate episode.
            discardIngestedAssets(ingestedAssetIds);
            return episodeRepository.findByTenantIdAndImportIdentity(tenantId, importIdentity)
                    .map(episode -> new ImportedEpisode(episode, true))
                    .orElseThrow(() -> ex);
        } catch (RuntimeException ex) {
            discardIngestedAssets(ingestedAssetIds);
            throw ex;
        }
    }

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

    private String uniqueSlug(Long tenantId, String requested, String title) {
        String base = requested == null || requested.isBlank()
                ? ImportSlugSuggester.suggest(title)
                : requested.trim().toLowerCase(Locale.ROOT);
        for (int attempt = 1; attempt <= 50; attempt++) {
            String candidate = ImportSlugSuggester.withSuffix(base, attempt);
            if (!episodeRepository.existsByTenantIdAndSlug(tenantId, candidate)) {
                return candidate;
            }
        }
        throw new RssImportException(409, "EPISODE_SLUG_EXISTS", "Could not allocate a unique episode slug");
    }

    private static String filenameFromUrl(String url, String fallback) {
        int slash = url.lastIndexOf('/');
        String last = slash >= 0 ? url.substring(slash + 1) : url;
        int query = last.indexOf('?');
        if (query >= 0) {
            last = last.substring(0, query);
        }
        return last.isBlank() ? fallback : last;
    }

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
            byte[] value = (feedUrl.trim() + "\n" + guid.trim()).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(digest.digest(value));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
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
            Long coverAssetId
    ) {
        public ImportEpisodeCommand {
            formatIds = formatIds == null ? Set.of() : new LinkedHashSet<>(formatIds);
            categoryIds = categoryIds == null ? Set.of() : new LinkedHashSet<>(categoryIds);
        }
    }

    public record ImportedEpisode(Episode episode, boolean alreadyImported) {
    }
}
