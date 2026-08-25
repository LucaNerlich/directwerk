package de.pnnit.directwerk.controller.platform;

import de.pnnit.directwerk.api.dto.CreateUploadUrlRequest;
import de.pnnit.directwerk.api.dto.MediaAssetView;
import de.pnnit.directwerk.api.dto.UploadUrlResponse;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.digital.api.MediaAssetLifecycleApi;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.api.UploadApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
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

/**
 * Platform ops view of a tenant's media assets (directwerk-admin Storage page).
 * Upload/confirm run under {@link TenantContext} for the path tenant so Hibernate
 * filters and {@code UploadService} key prefixes stay tenant-scoped.
 * <p>
 * Public READY assets include a stable {@code cdnUrl}. Private signed download URLs
 * are not exposed here. DELETE authorizes, marks {@code PENDING_DELETE}, and enqueues
 * S3 delete (+ CDN purge) jobs — workers tombstone as {@code ARCHIVED}. Restore is not supported.
 */
@RestController
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequestMapping("/api/v1/platform/tenants/{tenantId}/media")
public class PlatformTenantMediaController {

    private final MediaAssetQueryApi mediaAssetQueryApi;
    private final UploadApi uploadApi;
    private final MediaAssetLifecycleApi mediaAssetLifecycleApi;
    private final S3PublicUrlBuilder publicUrlBuilder;

    public PlatformTenantMediaController(
            MediaAssetQueryApi mediaAssetQueryApi,
            UploadApi uploadApi,
            MediaAssetLifecycleApi mediaAssetLifecycleApi,
            S3PublicUrlBuilder publicUrlBuilder
    ) {
        this.mediaAssetQueryApi = mediaAssetQueryApi;
        this.uploadApi = uploadApi;
        this.mediaAssetLifecycleApi = mediaAssetLifecycleApi;
        this.publicUrlBuilder = publicUrlBuilder;
    }

    @GetMapping
    ResponseEntity<Response<TenantMediaListResponse>> listMedia(
            @PathVariable Long tenantId,
            @RequestParam(required = false) AssetType assetType,
            @RequestParam(required = false) AssetStatus status,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit
    ) {
        List<MediaAssetView> assets = mediaAssetQueryApi
                .listForTenant(tenantId, assetType, status, limit)
                .stream()
                .map(this::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(new TenantMediaListResponse(
                assets,
                publicUrlBuilder.publicCdnBaseUrl()
        )));
    }

    @PostMapping("/upload-url")
    ResponseEntity<Response<UploadUrlResponse>> createUploadUrl(
            @PathVariable Long tenantId,
            @Valid @RequestBody CreateUploadUrlRequest request
    ) {
        UploadApi.UploadUrlResult result = TenantContext.callWithTenant(
                tenantId,
                () -> uploadApi.createUploadUrl(new UploadApi.CreateUploadUrlCommand(
                        request.filename(),
                        request.mimeType(),
                        request.sizeBytes(),
                        request.assetType(),
                        request.intendedVisibility(),
                        request.scope(),
                        request.episodeId(),
                        request.ownerUserId()
                ))
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Response.created(new UploadUrlResponse(
                result.assetId(),
                result.uploadUrl(),
                result.expiresAt(),
                result.headers()
        )));
    }

    @PostMapping("/{assetId}/confirm")
    ResponseEntity<Response<MediaAssetView>> confirmUpload(
            @PathVariable Long tenantId,
            @PathVariable Long assetId
    ) {
        MediaAssetView view = TenantContext.callWithTenant(tenantId, () -> {
            UploadApi.ConfirmUploadResult result = uploadApi.confirmUpload(
                    new UploadApi.ConfirmUploadCommand(assetId)
            );
            MediaAsset asset = mediaAssetQueryApi.findById(result.mediaAssetId())
                    .orElseThrow(() -> new MediaAssetNotFoundException(assetId));
            // Prefer confirm result for CDN — authoritative post-promote key/visibility.
            String cdnUrl = resolveCdnUrl(
                    result.visibility(),
                    AssetStatus.valueOf(result.status()),
                    result.s3Key()
            );
            if (cdnUrl == null) {
                cdnUrl = resolveCdnUrl(asset);
            }
            return toView(asset, cdnUrl);
        });
        return ResponseEntity.ok(Response.ok(view));
    }

    @DeleteMapping("/{assetId}")
    ResponseEntity<Response<MediaAssetView>> deleteMedia(
            @PathVariable Long tenantId,
            @PathVariable Long assetId
    ) {
        MediaAssetView view = TenantContext.callWithTenant(tenantId, () -> {
            MediaAsset deleted = mediaAssetLifecycleApi.delete(
                    new MediaAssetLifecycleApi.DeleteCommand(assetId, null, true)
            );
            // Pending/archived assets must not expose CDN URLs.
            return toView(deleted, null);
        });
        return ResponseEntity.ok(Response.ok(view));
    }

    private MediaAssetView toView(MediaAsset asset) {
        return toView(asset, resolveCdnUrl(asset));
    }

    private MediaAssetView toView(MediaAsset asset, String cdnUrl) {
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
                cdnUrl,
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
        // Public assets must live under the public/ prefix after confirm.
        String normalized = s3Key.startsWith("/") ? s3Key.substring(1) : s3Key;
        if (!normalized.contains("/public/")) {
            return null;
        }
        return publicUrlBuilder.cdnUrl(normalized).toString();
    }

    public record TenantMediaListResponse(
            List<MediaAssetView> content,
            String publicCdnBaseUrl
    ) {
    }
}
