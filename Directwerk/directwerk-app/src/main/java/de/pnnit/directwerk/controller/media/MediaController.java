package de.pnnit.directwerk.controller.media;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.api.MediaAssetLifecycleApi;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.api.UploadApi;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.net.URL;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiresModule(DigitalContentModule.KEY)
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/media")
public class MediaController {

    private final UploadApi uploadApi;
    private final MediaAssetQueryApi mediaAssetQueryApi;
    private final AssetAccessApi assetAccessApi;
    private final MediaAssetLifecycleApi mediaAssetLifecycleApi;
    private final S3PublicUrlBuilder publicUrlBuilder;

    public MediaController(
            UploadApi uploadApi,
            MediaAssetQueryApi mediaAssetQueryApi,
            AssetAccessApi assetAccessApi,
            MediaAssetLifecycleApi mediaAssetLifecycleApi,
            S3PublicUrlBuilder publicUrlBuilder
    ) {
        this.uploadApi = uploadApi;
        this.mediaAssetQueryApi = mediaAssetQueryApi;
        this.assetAccessApi = assetAccessApi;
        this.mediaAssetLifecycleApi = mediaAssetLifecycleApi;
        this.publicUrlBuilder = publicUrlBuilder;
    }

    @PostMapping("/upload-url")
    ResponseEntity<Response<UploadUrlResponse>> createUploadUrl(
            @Valid @RequestBody CreateUploadUrlRequest request
    ) {
        UploadApi.UploadUrlResult result = uploadApi.createUploadUrl(new UploadApi.CreateUploadUrlCommand(
                request.filename(),
                request.mimeType(),
                request.sizeBytes(),
                request.assetType(),
                request.intendedVisibility(),
                request.scope(),
                request.episodeId(),
                request.ownerUserId()
        ));
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(new UploadUrlResponse(
                result.assetId(),
                result.uploadUrl(),
                result.expiresAt(),
                result.headers()
        )));
    }

    @PostMapping("/{id}/confirm")
    ResponseEntity<Response<MediaAssetView>> confirm(@PathVariable("id") Long id) {
        UploadApi.ConfirmUploadResult result = uploadApi.confirmUpload(new UploadApi.ConfirmUploadCommand(id));
        MediaAsset asset = mediaAssetQueryApi.findById(result.mediaAssetId())
                .orElseThrow(() -> new MediaAssetNotFoundException(id));
        return ResponseEntity.ok(Response.ok(toView(asset)));
    }

    @GetMapping
    ResponseEntity<Response<List<MediaAssetView>>> list(
            @RequestParam(required = false) AssetType assetType,
            @RequestParam(required = false) AssetStatus status,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit
    ) {
        List<MediaAssetView> assets = mediaAssetQueryApi.list(assetType, status, limit).stream()
                .map(this::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(assets));
    }

    @GetMapping("/{id}")
    ResponseEntity<Response<MediaAssetView>> get(@PathVariable("id") Long id) {
        MediaAsset asset = mediaAssetQueryApi.findById(id)
                .orElseThrow(() -> new MediaAssetNotFoundException(id));
        return ResponseEntity.ok(Response.ok(toView(asset)));
    }

    @GetMapping("/{id}/preview-url")
    ResponseEntity<Response<PreviewUrlResponse>> previewUrl(
            @PathVariable("id") Long id,
            @RequestParam(defaultValue = "true") boolean previewDraft
    ) {
        MediaAsset asset = mediaAssetQueryApi.findById(id)
                .orElseThrow(() -> new MediaAssetNotFoundException(id));
        DirectwerkUserPrincipal principal = SecurityUtils.requirePrincipal();
        URL url = assetAccessApi.resolvePreviewUrl(asset, principal, previewDraft);
        return ResponseEntity.ok(Response.ok(new PreviewUrlResponse(url.toString())));
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Response<MediaAssetView>> delete(@PathVariable("id") Long id) {
        DirectwerkUserPrincipal principal = SecurityUtils.requirePrincipal();
        MediaAsset deleted = mediaAssetLifecycleApi.delete(
                new MediaAssetLifecycleApi.DeleteCommand(id, principal, false)
        );
        return ResponseEntity.ok(Response.ok(toView(deleted)));
    }

    private MediaAssetView toView(MediaAsset asset) {
        return new MediaAssetView(
                asset.getId(),
                asset.getS3Key(),
                asset.getVisibility().name(),
                asset.getScope().name(),
                asset.getAssetType().name(),
                asset.getStatus().name(),
                asset.getMimeType(),
                asset.getSizeBytes(),
                asset.getOriginalFilename(),
                asset.getEpisodeId(),
                asset.getOwnerUserId(),
                resolveCdnUrl(asset),
                asset.getCreatedAt(),
                asset.getUpdatedAt()
        );
    }

    private String resolveCdnUrl(MediaAsset asset) {
        return resolveCdnUrl(asset.getVisibility(), asset.getStatus(), asset.getS3Key());
    }

    /**
     * Stable CDN URL for public READY objects only. Private assets stay null —
     * they must not be served via the public pull zone.
     */
    private String resolveCdnUrl(AssetVisibility visibility, AssetStatus status, String s3Key) {
        if (visibility != AssetVisibility.PUBLIC
                || status != AssetStatus.READY
                || s3Key == null
                || s3Key.isBlank()) {
            return null;
        }
        String normalized = s3Key.startsWith("/") ? s3Key.substring(1) : s3Key;
        if (!normalized.contains("/public/")) {
            return null;
        }
        return publicUrlBuilder.cdnUrl(normalized).toString();
    }

    public record CreateUploadUrlRequest(
            @NotBlank @Size(max = 255) String filename,
            @NotBlank @Size(max = 128) String mimeType,
            @Positive long sizeBytes,
            @NotNull AssetType assetType,
            AssetVisibility intendedVisibility,
            AssetScope scope,
            @Positive Long episodeId,
            @Positive Long ownerUserId
    ) {
    }

    public record UploadUrlResponse(
            Long assetId,
            String uploadUrl,
            Instant expiresAt,
            Map<String, String> headers
    ) {
    }

    public record PreviewUrlResponse(String url) {
    }

    public record MediaAssetView(
            Long id,
            String s3Key,
            String visibility,
            String scope,
            String assetType,
            String status,
            String mimeType,
            Long sizeBytes,
            String originalFilename,
            Long episodeId,
            Long ownerUserId,
            String cdnUrl,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
