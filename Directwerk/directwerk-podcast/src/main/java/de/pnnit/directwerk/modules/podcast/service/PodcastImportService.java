package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.api.RemoteAssetIngestApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.importing.FeedImportSupport;
import de.pnnit.directwerk.modules.digital.net.RemoteContentClient;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.exception.RssImportException;
import de.pnnit.directwerk.modules.podcast.importrss.ImportSlugSuggester;
import de.pnnit.directwerk.modules.podcast.importrss.ParsedRssFeed;
import de.pnnit.directwerk.modules.podcast.importrss.RssFeedParser;
import de.pnnit.directwerk.modules.podcast.repository.EpisodeRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
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

    private static final Duration FEED_TIMEOUT = Duration.ofSeconds(30);
    private static final FeedImportSupport.ImportErrorFactory RSS_IMPORT_ERRORS =
            (status, code, message, cause) -> cause == null
                    ? new RssImportException(status, code, message)
                    : new RssImportException(status, code, message, cause);

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
        )).asset();
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
                RemoteAssetIngestApi.IngestResult audio = ingestAssetTracked(
                        command.audioUrl(),
                        AssetType.AUDIO,
                        AssetVisibility.PRIVATE,
                        importFilenameHint(command.title(), command.audioUrl(), "episode", "mp3")
                );
                audioAssetId = audio.asset().getId();
                if (!audio.reused()) {
                    ingestedAssetIds.add(audioAssetId);
                }
            }
            if (coverAssetId == null && command.imageUrl() != null && !command.imageUrl().isBlank()) {
                RemoteAssetIngestApi.IngestResult cover = ingestAssetTracked(
                        command.imageUrl(),
                        AssetType.IMAGE,
                        AssetVisibility.PUBLIC,
                        importFilenameHint(command.title(), command.imageUrl(), "cover", "jpg")
                );
                coverAssetId = cover.asset().getId();
                if (!cover.reused()) {
                    ingestedAssetIds.add(coverAssetId);
                }
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
        FeedImportSupport.discardIngestedAssets(
                assetIds,
                remoteAssetIngestApi::discard,
                log,
                "unreferenced RSS import asset"
        );
    }

    /**
     * Downloads and parses an RSS feed after validating its URL and response content.
     *
     * @param feedUrl the URL of the RSS feed
     * @return the parsed RSS feed
     */
    private ParsedRssFeed fetchAndParse(String feedUrl) {
        return FeedImportSupport.fetchAndParse(
                remoteContentClient,
                feedUrl,
                FEED_TIMEOUT,
                FeedImportSupport.MAX_FEED_BYTES,
                RSS_IMPORT_ERRORS,
                rssFeedParser::parse
        );
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
        return FeedImportSupport.uniqueSlug(
                tenantId,
                requested,
                title,
                "folge",
                episodeRepository::existsByTenantIdAndSlug,
                () -> new RssImportException(409, "EPISODE_SLUG_EXISTS", "Could not allocate a unique episode slug")
        );
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
        return FeedImportSupport.importFilenameHint(title, url, fallbackStem, extension, "folge");
    }

    /**
     * Creates a stable identity for an episode imported from an RSS feed.
     *
     * @param feedUrl the RSS feed URL
     * @param guid    the episode's feed GUID
     * @return the SHA-256 hexadecimal digest of the canonical feed URL and trimmed GUID
     */
    static String importIdentity(String feedUrl, String guid) {
        return FeedImportSupport.importIdentity(feedUrl, guid, "episode", RSS_IMPORT_ERRORS);
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
