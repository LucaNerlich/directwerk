package de.pnnit.directwerk.controller.podcast;

import de.pnnit.directwerk.api.MediaAssetViewMapper;
import de.pnnit.directwerk.api.PublicEpisodeViewMapper;
import de.pnnit.directwerk.api.dto.MediaAssetView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.service.PodcastImportService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiresModule(PodcastModule.KEY)
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/podcast/import")
public class PodcastImportController {

    private final PodcastImportService podcastImportService;
    private final PublicEpisodeViewMapper publicEpisodeViewMapper;
    private final MediaAssetViewMapper mediaAssetViewMapper;
    private final MediaAssetQueryApi mediaAssetQueryApi;

    /**
     * Creates a controller for podcast preview, asset ingestion, and episode import operations.
     */
    public PodcastImportController(
            PodcastImportService podcastImportService,
            PublicEpisodeViewMapper publicEpisodeViewMapper,
            MediaAssetViewMapper mediaAssetViewMapper,
            MediaAssetQueryApi mediaAssetQueryApi
    ) {
        this.podcastImportService = podcastImportService;
        this.publicEpisodeViewMapper = publicEpisodeViewMapper;
        this.mediaAssetViewMapper = mediaAssetViewMapper;
        this.mediaAssetQueryApi = mediaAssetQueryApi;
    }

    /**
     * Previews the podcast feed identified by the request.
     *
     * @param request the podcast feed preview request
     * @return the podcast feed and episode preview
     */
    @PostMapping("/preview")
    ResponseEntity<Response<PreviewView>> preview(@Valid @RequestBody PreviewRequest request) {
        PodcastImportService.Preview preview = podcastImportService.preview(request.feedUrl());
        return ResponseEntity.ok(Response.ok(toPreviewView(preview)));
    }

    /**
     * Ingests a media asset from the supplied source details.
     *
     * @return the created media asset view
     */
    @PostMapping("/assets")
    ResponseEntity<Response<MediaAssetView>> ingestAsset(@Valid @RequestBody IngestAssetRequest request) {
        boolean waitForCompletion = request.waitForCompletion() == null || request.waitForCompletion();
        MediaAsset asset = waitForCompletion
                ? podcastImportService.ingestAsset(
                        request.sourceUrl(),
                        request.assetType(),
                        request.visibility() == null ? AssetVisibility.PRIVATE : request.visibility(),
                        request.filename()
                )
                : podcastImportService.startIngestAsset(
                        request.sourceUrl(),
                        request.assetType(),
                        request.visibility() == null ? AssetVisibility.PRIVATE : request.visibility(),
                        request.filename()
                );
        HttpStatus status = waitForCompletion ? HttpStatus.CREATED : HttpStatus.ACCEPTED;
        return ResponseEntity.status(status).body(
                waitForCompletion ? Response.created(mediaAssetViewMapper.toView(asset)) : Response.ok(mediaAssetViewMapper.toView(asset))
        );
    }

    /**
     * Returns a pending or completed import asset for progress polling during RSS ingest.
     */
    @GetMapping("/assets/{assetId}")
    ResponseEntity<Response<MediaAssetView>> getIngestAsset(@PathVariable @Min(1) Long assetId) {
        MediaAsset asset = mediaAssetQueryApi.findById(assetId)
                .orElseThrow(() -> new MediaAssetNotFoundException(assetId));
        return ResponseEntity.ok(Response.ok(mediaAssetViewMapper.toView(asset)));
    }

    /**
     * Imports an episode and indicates whether it was already imported.
     *
     * @param request the episode import details
     * @return the imported episode view with HTTP 201 when newly imported, or HTTP 200 when already imported
     */
    @PostMapping("/episodes")
    ResponseEntity<Response<ImportedEpisodeView>> importEpisode(@Valid @RequestBody ImportEpisodeRequest request) {
        PodcastImportService.ImportedEpisode imported = podcastImportService.importEpisode(
                new PodcastImportService.ImportEpisodeCommand(
                        request.seriesId(),
                        request.feedUrl(),
                        request.guid(),
                        request.slug(),
                        request.title(),
                        request.description(),
                        request.episodeNumber(),
                        request.durationSeconds(),
                        request.accessPolicy(),
                        request.requiredLevelSortOrder(),
                        request.formatIds(),
                        request.categoryIds(),
                        request.audioUrl(),
                        request.imageUrl(),
                        request.audioAssetId(),
                        request.coverAssetId(),
                        request.publishedAt()
                )
        );
        HttpStatus status = imported.alreadyImported() ? HttpStatus.OK : HttpStatus.CREATED;
        ImportedEpisodeView view = new ImportedEpisodeView(
                publicEpisodeViewMapper.toStudioView(imported.episode()),
                imported.alreadyImported()
        );
        return ResponseEntity.status(status).body(
                imported.alreadyImported() ? Response.ok(view) : Response.created(view)
        );
    }

    /**
     * Converts a podcast import preview into its API response representation.
     *
     * @param preview the podcast import preview to convert
     * @return the preview view containing channel and episode details
     */
    private static PreviewView toPreviewView(PodcastImportService.Preview preview) {
        return new PreviewView(
                preview.feedUrl(),
                new ChannelView(
                        preview.channel().title(),
                        preview.channel().description(),
                        preview.channel().language(),
                        preview.channel().itunesCategory(),
                        preview.channel().imageUrl(),
                        preview.channel().link(),
                        preview.channel().suggestedSlug()
                ),
                preview.episodes().stream()
                        .map(item -> new EpisodePreviewView(
                                item.guid(),
                                item.title(),
                                item.description(),
                                item.publishedAt() == null ? null : item.publishedAt().toString(),
                                item.durationSeconds(),
                                item.episodeNumber(),
                                item.audioUrl(),
                                item.audioMimeType(),
                                item.audioSizeBytes(),
                                item.imageUrl(),
                                item.suggestedSlug(),
                                item.alreadyImportedEpisodeId()
                        ))
                        .toList(),
                preview.truncated()
        );
    }

    public record PreviewRequest(@NotBlank @Size(max = 2048) String feedUrl) {
    }

    public record IngestAssetRequest(
            @NotBlank @Size(max = 2048) String sourceUrl,
            @NotNull AssetType assetType,
            AssetVisibility visibility,
            @Size(max = 180) String filename,
            Boolean waitForCompletion
    ) {
    }

    public record ImportEpisodeRequest(
            @NotNull @Min(1) Long seriesId,
            @NotBlank @Size(max = 2048) String feedUrl,
            @NotBlank @Size(max = 512) String guid,
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @NotBlank @Size(max = 255) String title,
            String description,
            @Min(1) Integer episodeNumber,
            @Min(1) Integer durationSeconds,
            AccessPolicy accessPolicy,
            @Min(0) Integer requiredLevelSortOrder,
            Set<@Min(1) Long> formatIds,
            Set<@Min(1) Long> categoryIds,
            @Size(max = 2048) String audioUrl,
            @Size(max = 2048) String imageUrl,
            @Min(1) Long audioAssetId,
            @Min(1) Long coverAssetId,
            Instant publishedAt
    ) {
    }

    public record PreviewView(
            String feedUrl,
            ChannelView channel,
            List<EpisodePreviewView> episodes,
            boolean truncated
    ) {
    }

    public record ChannelView(
            String title,
            String description,
            String language,
            String itunesCategory,
            String imageUrl,
            String link,
            String suggestedSlug
    ) {
    }

    public record EpisodePreviewView(
            String guid,
            String title,
            String description,
            String publishedAt,
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

    public record ImportedEpisodeView(
            EpisodeController.EpisodeView episode,
            boolean alreadyImported
    ) {
    }
}
