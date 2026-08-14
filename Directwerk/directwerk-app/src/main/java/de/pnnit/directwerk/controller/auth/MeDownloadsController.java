package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.EntitlementDeniedException;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@PreAuthorize("isAuthenticated()")
@RequestMapping("/api/v1/me/downloads")
public class MeDownloadsController {

    private static final int MAX_DOWNLOADS = 50;

    private final EntitlementService entitlementService;
    private final MediaAssetQueryApi mediaAssetQueryApi;
    private final AssetAccessApi assetAccessApi;
    private final ModuleGateService moduleGateService;

    public MeDownloadsController(
            EntitlementService entitlementService,
            MediaAssetQueryApi mediaAssetQueryApi,
            AssetAccessApi assetAccessApi,
            ModuleGateService moduleGateService
    ) {
        this.entitlementService = entitlementService;
        this.mediaAssetQueryApi = mediaAssetQueryApi;
        this.assetAccessApi = assetAccessApi;
        this.moduleGateService = moduleGateService;
    }

    @GetMapping
    ResponseEntity<Response<List<DownloadView>>> listDownloads(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        moduleGateService.requireModule(DigitalContentModule.KEY);
        moduleGateService.requireModule(SubscriptionModule.MODULE_KEY);

        List<Long> assetIds = entitlementService.listEntitledDigitalAssetIds(user.tenantId(), user.userId());
        List<DownloadView> downloads = new ArrayList<>();
        for (Long assetId : assetIds) {
            if (downloads.size() >= MAX_DOWNLOADS) {
                break;
            }
            mediaAssetQueryApi.findById(assetId)
                    .filter(asset -> asset.getStatus() == AssetStatus.READY)
                    .ifPresent(asset -> addIfAuthorized(downloads, asset, user));
        }
        return ResponseEntity.ok(Response.ok(downloads));
    }

    private void addIfAuthorized(
            List<DownloadView> downloads,
            MediaAsset asset,
            DirectwerkUserPrincipal user
    ) {
        try {
            URL url = assetAccessApi.resolveDownloadUrl(asset, user);
            downloads.add(new DownloadView(
                    asset.getId(),
                    asset.getOriginalFilename() != null ? asset.getOriginalFilename() : ("Datei #" + asset.getId()),
                    asset.getAssetType().name(),
                    asset.getMimeType(),
                    asset.getSizeBytes(),
                    url.toString()
            ));
        } catch (EntitlementDeniedException ignored) {
            // Fail closed per asset — do not leak unauthorized files.
        }
    }

    public record DownloadView(
            Long id,
            String title,
            String assetType,
            String mimeType,
            Long sizeBytes,
            String downloadUrl
    ) {
    }
}
