package de.pnnit.directwerk.controller.media;

import de.pnnit.directwerk.api.MediaUploadCommandMapper;
import de.pnnit.directwerk.api.dto.CreateUploadUrlRequest;
import de.pnnit.directwerk.api.dto.MediaAssetView;
import de.pnnit.directwerk.api.dto.UploadUrlResponse;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.api.MediaAssetLifecycleApi;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.api.UploadApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.api.MediaAssetViewMapper;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URL;
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

@RestController
@RequiresModule(DigitalContentModule.KEY)
@PreAuthorize("hasAnyRole('EDITOR', 'TENANT_ADMIN')")
@RequestMapping("/api/v1/media")
public class MediaController {

    private final UploadApi uploadApi;
    private final MediaAssetQueryApi mediaAssetQueryApi;
    private final AssetAccessApi assetAccessApi;
    private final MediaAssetLifecycleApi mediaAssetLifecycleApi;
    private final MediaAssetViewMapper mediaAssetViewMapper;
    private final MediaUploadCommandMapper mediaUploadCommandMapper;

    public MediaController(
            UploadApi uploadApi,
            MediaAssetQueryApi mediaAssetQueryApi,
            AssetAccessApi assetAccessApi,
            MediaAssetLifecycleApi mediaAssetLifecycleApi,
            MediaAssetViewMapper mediaAssetViewMapper,
            MediaUploadCommandMapper mediaUploadCommandMapper
    ) {
        this.uploadApi = uploadApi;
        this.mediaAssetQueryApi = mediaAssetQueryApi;
        this.assetAccessApi = assetAccessApi;
        this.mediaAssetLifecycleApi = mediaAssetLifecycleApi;
        this.mediaAssetViewMapper = mediaAssetViewMapper;
        this.mediaUploadCommandMapper = mediaUploadCommandMapper;
    }

    @PostMapping("/upload-url")
    ResponseEntity<Response<UploadUrlResponse>> createUploadUrl(
            @Valid @RequestBody CreateUploadUrlRequest request
    ) {
        UploadApi.UploadUrlResult result = uploadApi.createUploadUrl(mediaUploadCommandMapper.toCommand(request));
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
        return ResponseEntity.ok(Response.ok(mediaAssetViewMapper.toView(asset)));
    }

    @GetMapping
    ResponseEntity<Response<List<MediaAssetView>>> list(
            @RequestParam(required = false) AssetType assetType,
            @RequestParam(required = false) AssetStatus status,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit
    ) {
        List<MediaAssetView> assets = mediaAssetQueryApi.list(assetType, status, limit).stream()
                .map(mediaAssetViewMapper::toView)
                .toList();
        return ResponseEntity.ok(Response.ok(assets));
    }

    @GetMapping("/{id}")
    ResponseEntity<Response<MediaAssetView>> get(@PathVariable("id") Long id) {
        MediaAsset asset = mediaAssetQueryApi.findById(id)
                .orElseThrow(() -> new MediaAssetNotFoundException(id));
        requireTenantAsset(asset, id);
        return ResponseEntity.ok(Response.ok(mediaAssetViewMapper.toView(asset)));
    }

    @GetMapping("/{id}/preview-url")
    ResponseEntity<Response<PreviewUrlResponse>> previewUrl(
            @PathVariable("id") Long id,
            @RequestParam(defaultValue = "true") boolean previewDraft
    ) {
        MediaAsset asset = mediaAssetQueryApi.findById(id)
                .orElseThrow(() -> new MediaAssetNotFoundException(id));
        requireTenantAsset(asset, id);
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
        return ResponseEntity.ok(Response.ok(mediaAssetViewMapper.toView(deleted)));
    }

    public record PreviewUrlResponse(String url) {
    }

    /**
     * Defense in depth: the Hibernate tenantFilter normally scopes this lookup already,
     * but an explicit check keeps cross-tenant reads fail-closed even if the filter is
     * ever bypassed on this path.
     */
    private static void requireTenantAsset(MediaAsset asset, Long id) {
        Long tenantId = TenantContext.requireTenantId();
        if (asset.getTenant() == null || !tenantId.equals(asset.getTenant().getId())) {
            throw new MediaAssetNotFoundException(id);
        }
    }
}
