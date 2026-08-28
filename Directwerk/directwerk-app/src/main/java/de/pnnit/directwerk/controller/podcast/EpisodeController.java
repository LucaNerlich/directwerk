package de.pnnit.directwerk.controller.podcast;

import de.pnnit.directwerk.api.dto.CategoryView;
import de.pnnit.directwerk.api.dto.FormatView;
import de.pnnit.directwerk.api.PublicEpisodeViewMapper;
import de.pnnit.directwerk.api.dto.PublishOptionsRequest;
import de.pnnit.directwerk.api.dto.ReplaceCategoriesRequest;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.podcast.PodcastModule;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.Category;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.Format;
import de.pnnit.directwerk.modules.podcast.service.EpisodeService;
import de.pnnit.directwerk.modules.podcast.service.PublicationWorkflowService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiresModule(PodcastModule.KEY)
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/episodes")
public class EpisodeController {

    private final EpisodeService episodeService;
    private final PublicationWorkflowService publicationWorkflowService;
    private final PublicEpisodeViewMapper publicEpisodeViewMapper;

    public EpisodeController(
            EpisodeService episodeService,
            PublicationWorkflowService publicationWorkflowService,
            PublicEpisodeViewMapper publicEpisodeViewMapper
    ) {
        this.episodeService = episodeService;
        this.publicationWorkflowService = publicationWorkflowService;
        this.publicEpisodeViewMapper = publicEpisodeViewMapper;
    }

    @GetMapping
    ResponseEntity<Response<List<EpisodeView>>> listEpisodes() {
        Long tenantId = TenantContext.requireTenantId();
        List<EpisodeView> episodes = episodeService.listEpisodes(tenantId).stream()
                .map(publicEpisodeViewMapper::toStudioView)
                .toList();
        return ResponseEntity.ok(Response.ok(episodes));
    }

    @GetMapping("/{episodeId}")
    ResponseEntity<Response<EpisodeView>> getEpisode(@PathVariable Long episodeId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(episodeService.requireEpisode(tenantId, episodeId))));
    }

    @PostMapping
    ResponseEntity<Response<EpisodeView>> createDraft(@Valid @RequestBody CreateEpisodeRequest request) {
        Long tenantId = TenantContext.requireTenantId();
                Episode episode = episodeService.createDraft(
                tenantId,
                request.seriesId(),
                request.episodeNumber(),
                request.slug(),
                request.title(),
                request.description(),
                request.audioAssetId(),
                request.durationSeconds(),
                request.accessPolicy(),
                request.requiredLevelSortOrder(),
                request.formatIds(),
                request.categoryIds()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(publicEpisodeViewMapper.toStudioView(episode)));
    }

    @PutMapping("/{episodeId}")
    ResponseEntity<Response<EpisodeView>> updateDraft(
            @PathVariable Long episodeId,
            @Valid @RequestBody UpdateEpisodeRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
                Episode episode = episodeService.updateDraft(
                tenantId,
                episodeId,
                request.episodeNumber(),
                request.slug(),
                request.title(),
                request.description(),
                request.durationSeconds(),
                request.accessPolicy(),
                request.requiredLevelSortOrder()
        );
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(episode)));
    }

    @PutMapping("/{episodeId}/formats")
    ResponseEntity<Response<EpisodeView>> replaceFormats(
            @PathVariable Long episodeId,
            @Valid @RequestBody ReplaceFormatsRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(
                episodeService.replaceFormats(tenantId, episodeId, request.formatIds())
        )));
    }

    @PutMapping("/{episodeId}/categories")
    ResponseEntity<Response<EpisodeView>> replaceCategories(
            @PathVariable Long episodeId,
            @Valid @RequestBody ReplaceCategoriesRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(
                episodeService.replaceCategories(tenantId, episodeId, request.categoryIds())
        )));
    }

    @PostMapping("/{episodeId}/audio")
    ResponseEntity<Response<EpisodeView>> attachAudio(
            @PathVariable Long episodeId,
            @Valid @RequestBody AttachAudioRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(
                episodeService.attachAudio(tenantId, episodeId, request.audioAssetId())
        )));
    }

    @PutMapping("/{episodeId}/enclosure-enabled")
    ResponseEntity<Response<EpisodeView>> setEnclosureEnabled(
            @PathVariable Long episodeId,
            @Valid @RequestBody EnclosureEnabledRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(
                episodeService.setEnclosureEnabled(tenantId, episodeId, request.enabled())
        )));
    }

    @PostMapping("/{episodeId}/publish")
    ResponseEntity<Response<EpisodeView>> publish(
            @PathVariable Long episodeId,
            @RequestBody(required = false) PublishOptionsRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        boolean notifySubscribers = request != null && Boolean.TRUE.equals(request.notifySubscribers());
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(
                publicationWorkflowService.publish(tenantId, episodeId, notifySubscribers)
        )));
    }

    @PostMapping("/{episodeId}/schedule")
    ResponseEntity<Response<EpisodeView>> schedule(
            @PathVariable Long episodeId,
            @Valid @RequestBody ScheduleEpisodeRequest request
    ) {
        Long tenantId = TenantContext.requireTenantId();
        Episode episode = publicationWorkflowService.schedule(
                tenantId,
                episodeId,
                request.scheduledAt(),
                Boolean.TRUE.equals(request.notifySubscribers())
        );
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(episode)));
    }

    @PostMapping("/{episodeId}/cancel-schedule")
    ResponseEntity<Response<EpisodeView>> cancelSchedule(@PathVariable Long episodeId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(
                publicationWorkflowService.cancelSchedule(tenantId, episodeId)
        )));
    }

    @PostMapping("/{episodeId}/unpublish")
    ResponseEntity<Response<EpisodeView>> unpublish(@PathVariable Long episodeId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(publicationWorkflowService.unpublish(tenantId, episodeId))));
    }

    @PostMapping("/{episodeId}/archive")
    ResponseEntity<Response<EpisodeView>> archive(@PathVariable Long episodeId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(publicationWorkflowService.archive(tenantId, episodeId))));
    }

    @PostMapping("/{episodeId}/unarchive")
    ResponseEntity<Response<EpisodeView>> unarchive(@PathVariable Long episodeId) {
        Long tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(Response.ok(publicEpisodeViewMapper.toStudioView(publicationWorkflowService.unarchive(tenantId, episodeId))));
    }

    public record CreateEpisodeRequest(
            @NotNull @Min(1) Long seriesId,
            @Min(1) Integer episodeNumber,
            @NotBlank
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @NotBlank @Size(max = 255) String title,
            String description,
            @Min(1) Long audioAssetId,
            @Min(1) Integer durationSeconds,
            AccessPolicy accessPolicy,
            @Min(0) Integer requiredLevelSortOrder,
            Set<@Min(1) Long> formatIds,
            Set<@Min(1) Long> categoryIds
    ) {
    }

    public record UpdateEpisodeRequest(
            @Min(1) Integer episodeNumber,
            @Pattern(regexp = "^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$")
            String slug,
            @Size(max = 255) String title,
            String description,
            @Min(1) Integer durationSeconds,
            AccessPolicy accessPolicy,
            @Min(0) Integer requiredLevelSortOrder
    ) {
    }

    public record ReplaceFormatsRequest(Set<@Min(1) Long> formatIds) {
    }

    public record AttachAudioRequest(@NotNull @Min(1) Long audioAssetId) {
    }

    public record EnclosureEnabledRequest(@NotNull Boolean enabled) {
    }

    public record ScheduleEpisodeRequest(
            @NotNull Instant scheduledAt,
            Boolean notifySubscribers
    ) {
    }

    public record EpisodeView(
            Long id,
            Long seriesId,
            String seriesSlug,
            Integer episodeNumber,
            String slug,
            String title,
            String description,
            Long audioAssetId,
            Integer durationSeconds,
            String accessPolicy,
            Integer requiredLevelSortOrder,
            String status,
            boolean enclosureEnabled,
            Instant publishedAt,
            Instant scheduledAt,
            List<FormatView> formats,
            List<CategoryView> categories,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
