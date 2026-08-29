package de.pnnit.directwerk.controller.podcast;

import de.pnnit.directwerk.api.MediaAssetViewMapper;
import de.pnnit.directwerk.api.PublicEpisodeViewMapper;
import de.pnnit.directwerk.api.dto.MediaAssetView;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.podcast.service.PodcastImportService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    public PodcastImportController(
            PodcastImportService podcastImportService,
            PublicEpisodeViewMapper publicEpisodeViewMapper,
            MediaAssetViewMapper mediaAssetViewMapper
    ) {
        this.podcastImportService = podcastImportService;
        this.publicEpisodeViewMapper = publicEpisodeViewMapper;
        this.mediaAssetViewMapper = mediaAssetViewMapper;
    }

    @PostMapping("/preview")
    ResponseEntity<Response<PreviewView>> preview(@Valid @RequestBody PreviewRequest request) {
        PodcastImportService.Preview preview = podcastImportService.preview(request.feedUrl());
        return ResponseEntity.ok(Response.ok(toPreviewView(preview)));
    }

    @PostMapping("/assets")
    ResponseEntity<Response<MediaAssetView>> ingestAsset(@Valid @RequestBody IngestAssetRequest request) {
        MediaAsset asset = podcastImportService.ingestAsset(
                request.sourceUrl(),
                request.assetType(),
                request.visibility() == null ? AssetVisibility.PUBLIC : request.visibility(),
                request.filename()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(mediaAssetViewMapper.toView(asset)));
    }

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
                        request.coverAssetId()
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
            @Size(max = 180) String filename
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
            @Min(1) Long coverAssetId
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
