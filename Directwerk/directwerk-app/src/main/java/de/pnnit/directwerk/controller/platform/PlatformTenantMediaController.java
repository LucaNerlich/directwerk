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
import de.pnnit.directwerk.api.MediaAssetViewMapper;
import de.pnnit.directwerk.api.MediaUploadCommandMapper;
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
    private final MediaAssetViewMapper mediaAssetViewMapper;
    private final MediaUploadCommandMapper mediaUploadCommandMapper;

    public PlatformTenantMediaController(
            MediaAssetQueryApi mediaAssetQueryApi,
            UploadApi uploadApi,
            MediaAssetLifecycleApi mediaAssetLifecycleApi,
            S3PublicUrlBuilder publicUrlBuilder,
            MediaAssetViewMapper mediaAssetViewMapper,
            MediaUploadCommandMapper mediaUploadCommandMapper
    ) {
        this.mediaAssetQueryApi = mediaAssetQueryApi;
        this.uploadApi = uploadApi;
        this.mediaAssetLifecycleApi = mediaAssetLifecycleApi;
        this.publicUrlBuilder = publicUrlBuilder;
        this.mediaAssetViewMapper = mediaAssetViewMapper;
        this.mediaUploadCommandMapper = mediaUploadCommandMapper;
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
                .map(mediaAssetViewMapper::toView)
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
                () -> uploadApi.createUploadUrl(mediaUploadCommandMapper.toCommand(request))
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
            return mediaAssetViewMapper.toView(asset);
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
            return mediaAssetViewMapper.toView(deleted, null);
        });
        return ResponseEntity.ok(Response.ok(view));
    }

    public record TenantMediaListResponse(
            List<MediaAssetView> content,
            String publicCdnBaseUrl
    ) {
    }
}
