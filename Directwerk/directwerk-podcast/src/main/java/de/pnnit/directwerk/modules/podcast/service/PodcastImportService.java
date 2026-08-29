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
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
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
            Long existingId = episodeRepository.findByTenantIdAndImportGuid(tenantId, item.guid())
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
        if (command.guid() != null && !command.guid().isBlank()) {
            var existing = episodeRepository.findByTenantIdAndImportGuid(tenantId, command.guid().trim());
            if (existing.isPresent()) {
                return new ImportedEpisode(existing.get(), true);
            }
        }

        Long audioAssetId = null;
        if (command.audioUrl() != null && !command.audioUrl().isBlank()) {
            audioAssetId = ingestAsset(
                    command.audioUrl(),
                    AssetType.AUDIO,
                    command.accessPolicy() == AccessPolicy.FREE ? AssetVisibility.PUBLIC : AssetVisibility.PRIVATE,
                    filenameFromUrl(command.audioUrl(), "episode.mp3")
            ).getId();
        }
        Long coverAssetId = command.coverAssetId();
        if (command.imageUrl() != null && !command.imageUrl().isBlank()) {
            coverAssetId = ingestAsset(
                    command.imageUrl(),
                    AssetType.IMAGE,
                    AssetVisibility.PUBLIC,
                    filenameFromUrl(command.imageUrl(), "cover.jpg")
            ).getId();
        }

        String slug = uniqueSlug(tenantId, command.slug(), command.title());
        Episode episode = episodeService.createDraft(
                tenantId,
                command.seriesId(),
                command.episodeNumber(),
                slug,
                command.title(),
                command.description(),
                audioAssetId,
                coverAssetId,
                command.durationSeconds(),
                command.accessPolicy(),
                command.requiredLevelSortOrder(),
                command.formatIds(),
                command.categoryIds()
        );
        if (command.guid() != null && !command.guid().isBlank()) {
            episode = episodeService.setImportGuid(tenantId, episode.getId(), command.guid());
        }
        return new ImportedEpisode(episode, false);
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
            return rssFeedParser.parse(uri.toString(), new ByteArrayInputStream(xml));
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
                : requested.trim().toLowerCase();
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
