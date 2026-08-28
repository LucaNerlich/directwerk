package de.pnnit.directwerk.controller.auth;

import de.pnnit.directwerk.modules.podcast.access.SubscriberPortalAccessService;
import de.pnnit.directwerk.api.response.Response;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.SecurityUtils;
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

    private final SubscriberPortalAccessService subscriberContentAccessService;

    public MeDownloadsController(SubscriberPortalAccessService subscriberContentAccessService) {
        this.subscriberContentAccessService = subscriberContentAccessService;
    }

    @GetMapping
    ResponseEntity<Response<List<DownloadView>>> listDownloads(
            @AuthenticationPrincipal DirectwerkUserPrincipal principal
    ) {
        DirectwerkUserPrincipal user = SecurityUtils.requireTenantPrincipal(principal);
        List<DownloadView> downloads = subscriberContentAccessService.listDownloads(user).stream()
                .map(download -> {
                    var asset = download.asset();
                    return new DownloadView(
                            asset.getId(),
                            asset.getOriginalFilename() != null
                                    ? asset.getOriginalFilename()
                                    : ("Datei #" + asset.getId()),
                            asset.getAssetType().name(),
                            asset.getMimeType(),
                            asset.getSizeBytes(),
                            download.url().toString()
                    );
                })
                .toList();
        return ResponseEntity.ok(Response.ok(downloads));
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
