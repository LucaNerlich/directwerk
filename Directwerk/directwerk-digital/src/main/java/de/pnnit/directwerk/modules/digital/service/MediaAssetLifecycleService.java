package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.digital.storage.StorageConfigs;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.TenantLookupService;
import de.pnnit.directwerk.modules.core.util.TenantAssetKeys;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.api.MediaAssetLifecycleApi;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.AssetAccessDeniedException;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.job.MediaDeleteJobProducer;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.net.URL;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Queues irreversible media deletion. HTTP path only authorizes and marks
 * {@link AssetStatus#PENDING_DELETE}; S3 delete and CDN purge run as separate jobs.
 */
@Service
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
@RequiredArgsConstructor
@RequiresModule(DigitalContentModule.KEY)
public class MediaAssetLifecycleService implements MediaAssetLifecycleApi {

    private final MediaAssetRepository mediaAssetRepository;
    private final TenantLookupService tenantLookupService;
    private final DirectwerkConfig directwerkConfig;
    private final S3PublicUrlBuilder publicUrlBuilder;
    private final MediaDeleteJobProducer mediaDeleteJobProducer;

    @Override
    @Transactional
    public MediaAsset delete(DeleteCommand command) {
        StorageConfigs.requireEnabled(directwerkConfig);
        Long tenantId = TenantContext.requireTenantId();
        Tenant tenant = tenantLookupService.requireTenant(tenantId);

        MediaAsset asset = mediaAssetRepository.findById(command.mediaAssetId())
                .orElseThrow(() -> new MediaAssetNotFoundException(command.mediaAssetId()));
        if (!tenantId.equals(asset.getTenant().getId())) {
            throw new MediaAssetNotFoundException(command.mediaAssetId());
        }
        if (asset.getStatus() == AssetStatus.ARCHIVED) {
            throw new MediaAssetNotFoundException(command.mediaAssetId());
        }

        MediaAssetTenantCheck.assertTenantMatch(asset);
        TenantAssetKeys.requireTenantPrefix(tenant.getSlug(), asset.getS3Key());
        authorizeDelete(asset, command.principal(), command.platformOps());

        if (asset.getStatus() == AssetStatus.PENDING_DELETE) {
            // Idempotent: already queued for background deletion.
            return asset;
        }

        URL cdnUrlToPurge = resolvePublicCdnUrl(asset);
        asset.setStatus(AssetStatus.PENDING_DELETE);
        mediaAssetRepository.saveAndFlush(asset);

        mediaDeleteJobProducer.enqueueS3Delete(
                asset.getId(),
                asset.getS3Key(),
                cdnUrlToPurge != null ? cdnUrlToPurge.toString() : null
        );
        return asset;
    }

    private void authorizeDelete(
            MediaAsset asset,
            DirectwerkUserPrincipal principal,
            boolean platformOps
    ) {
        if (platformOps) {
            return;
        }
        if (principal == null) {
            throw new AssetAccessDeniedException(asset.getId());
        }

        switch (asset.getScope()) {
            case TENANT_PUBLIC, CONTENT, SYSTEM -> {
                if (!hasEditorOrAdmin(principal)) {
                    throw new AssetAccessDeniedException(asset.getId());
                }
            }
            case USER -> {
                boolean owner = asset.getOwnerUserId() != null
                        && asset.getOwnerUserId().equals(principal.userId());
                if (!owner && !hasTenantAdmin(principal)) {
                    throw new AssetAccessDeniedException(asset.getId());
                }
            }
            default -> throw new IllegalStateException("Unexpected scope: " + asset.getScope());
        }
    }

    /**
     * Same public-CDN eligibility as platform media views: PUBLIC + {@code /public/} key.
     */
    private URL resolvePublicCdnUrl(MediaAsset asset) {
        if (asset.getVisibility() != AssetVisibility.PUBLIC) {
            return null;
        }
        String s3Key = asset.getS3Key();
        if (s3Key == null || s3Key.isBlank()) {
            return null;
        }
        String normalized = s3Key.startsWith("/") ? s3Key.substring(1) : s3Key;
        if (!normalized.contains("/public/")) {
            return null;
        }
        return publicUrlBuilder.cdnUrl(normalized);
    }


    private static boolean hasEditorOrAdmin(DirectwerkUserPrincipal principal) {
        return principal.getAuthorities().stream()
                .anyMatch(authority ->
                        RoleConstants.EDITOR.equals(authority.getAuthority())
                                || RoleConstants.TENANT_ADMIN.equals(authority.getAuthority())
                );
    }

    private static boolean hasTenantAdmin(DirectwerkUserPrincipal principal) {
        return principal.getAuthorities().stream()
                .anyMatch(authority -> RoleConstants.TENANT_ADMIN.equals(authority.getAuthority()));
    }
}
