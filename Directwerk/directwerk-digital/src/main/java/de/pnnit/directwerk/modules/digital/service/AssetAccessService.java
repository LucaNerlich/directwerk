package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.util.TenantAssetKeys;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.digital.api.EntitlementApi;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.EntitlementDeniedException;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.BunnyTokenUrlSigner;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.net.URL;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

/**
 * Resolves public CDN URLs and private signed GET URLs after authorization.
 * Private delivery uses Bunny Advanced Token Auth on the private pull zone when configured;
 * otherwise falls back to S3 pre-signed GET.
 */
@Service
@RequiredArgsConstructor
public class AssetAccessService implements AssetAccessApi {

    private static final String PODCAST_MODULE = "PODCAST";

    private final EntitlementApi entitlementApi;
    private final ModuleGateService moduleGateService;
    private final S3PublicUrlBuilder publicUrlBuilder;
    private final ObjectProvider<S3Presigner> s3Presigner;
    private final DirectwerkConfig directwerkConfig;
    private final MediaAssetRepository mediaAssetRepository;

    @Override
    @Transactional(readOnly = true)
    public URL resolveDownloadUrl(MediaAsset asset, DirectwerkUserPrincipal principal) {
        MediaAsset managed = requireLoadedAsset(asset);
        MediaAssetTenantCheck.assertTenantMatch(managed);
        TenantAssetKeys.requireTenantPrefix(managed.getTenant().getSlug(), managed.getS3Key());

        if (managed.getVisibility() == AssetVisibility.PUBLIC) {
            return publicUrlBuilder.cdnUrl(managed.getS3Key());
        }

        authorizePrivateAsset(managed, principal, false);
        return resolvePrivateDownloadUrl(managed, apiDownloadTtl());
    }

    @Override
    @Transactional(readOnly = true)
    public URL resolveRssEnclosureUrl(MediaAsset asset, Long subscriberUserId) {
        MediaAsset managed = requireLoadedAsset(asset);
        MediaAssetTenantCheck.assertTenantMatch(managed);
        TenantAssetKeys.requireTenantPrefix(managed.getTenant().getSlug(), managed.getS3Key());

        if (managed.getVisibility() == AssetVisibility.PUBLIC) {
            return publicUrlBuilder.cdnUrl(managed.getS3Key());
        }

        authorizeRssContentAsset(managed, subscriberUserId);
        return resolvePrivateDownloadUrl(managed, rssDownloadTtl());
    }

    @Override
    @Transactional(readOnly = true)
    public URL resolvePreviewUrl(MediaAsset asset, DirectwerkUserPrincipal principal, boolean previewDraft) {
        MediaAsset managed = requireLoadedAsset(asset);
        MediaAssetTenantCheck.assertTenantMatch(managed);
        TenantAssetKeys.requireTenantPrefix(managed.getTenant().getSlug(), managed.getS3Key());

        if (principal == null || !hasEditorOrAdmin(principal)) {
            throw new AccessDeniedException("Preview requires EDITOR or TENANT_ADMIN");
        }

        if (managed.getVisibility() == AssetVisibility.PUBLIC) {
            return publicUrlBuilder.cdnUrl(managed.getS3Key());
        }

        // Publisher in-tenant preview: editors bypass CONTENT entitlements (including drafts)
        if (previewDraft || managed.getStatus() == AssetStatus.PENDING || managed.getStatus() == AssetStatus.READY) {
            authorizePrivateAsset(managed, principal, true);
            return resolvePrivateDownloadUrl(managed, apiDownloadTtl());
        }

        throw new EntitlementDeniedException(managed.getId());
    }

    private MediaAsset requireLoadedAsset(MediaAsset asset) {
        if (asset == null || asset.getId() == null) {
            throw new MediaAssetNotFoundException(asset != null ? asset.getId() : null);
        }
        return mediaAssetRepository.findById(asset.getId())
                .orElseThrow(() -> new MediaAssetNotFoundException(asset.getId()));
    }

    /**
     * Private object delivery: Bunny token URL on the private PZ when both
     * {@code private-cdn-base-url} and {@code cdn-token-auth-key} are set; otherwise S3 presign.
     */
    private URL resolvePrivateDownloadUrl(MediaAsset asset, Duration ttl) {
        DirectwerkProperties.Storage storage = directwerkConfig.storage();
        boolean hasPrivateCdn = storage != null && StringUtils.hasText(storage.privateCdnBaseUrl());
        boolean hasTokenKey = storage != null && StringUtils.hasText(storage.cdnTokenAuthKey());
        if (hasPrivateCdn && hasTokenKey) {
            return BunnyTokenUrlSigner.signObjectGet(
                    storage.privateCdnBaseUrl(),
                    asset.getS3Key(),
                    storage.cdnTokenAuthKey(),
                    ttl
            );
        }
        if (hasPrivateCdn || hasTokenKey) {
            throw new StorageNotConfiguredException(
                    "Private CDN token auth requires both private-cdn-base-url and cdn-token-auth-key"
            );
        }
        return presignGet(asset, ttl);
    }

    private URL presignGet(MediaAsset asset, Duration ttl) {
        S3Presigner presigner = Optional.ofNullable(s3Presigner.getIfAvailable())
                .orElseThrow(() -> new StorageNotConfiguredException(
                        "Object storage is disabled — cannot presign private assets"
                ));
        DirectwerkProperties.Storage storage = directwerkConfig.storage();
        if (storage == null || storage.bucket() == null || storage.bucket().isBlank()) {
            throw new StorageNotConfiguredException("Object storage bucket is not configured");
        }

        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(storage.bucket())
                .key(asset.getS3Key())
                .build();
        PresignedGetObjectRequest presigned = presigner.presignGetObject(GetObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .getObjectRequest(getObjectRequest)
                .build());
        return presigned.url();
    }

    private Duration apiDownloadTtl() {
        DirectwerkProperties.Storage storage = directwerkConfig.storage();
        return storage != null && storage.presignDownloadTtlApi() != null
                ? storage.presignDownloadTtlApi()
                : Duration.ofHours(1);
    }

    private Duration rssDownloadTtl() {
        DirectwerkProperties.Storage storage = directwerkConfig.storage();
        return storage != null && storage.presignDownloadTtlRss() != null
                ? storage.presignDownloadTtlRss()
                : Duration.ofHours(24);
    }

    private void authorizePrivateAsset(
            MediaAsset asset,
            DirectwerkUserPrincipal principal,
            boolean publisherPreview
    ) {
        if (principal == null) {
            throw new EntitlementDeniedException(asset.getId());
        }

        switch (asset.getScope()) {
            case CONTENT -> {
                if (publisherPreview && hasEditorOrAdmin(principal)) {
                    moduleGateService.requireModule(DigitalContentModule.KEY);
                    return;
                }
                authorizeContentAsset(asset, principal);
            }
            case USER -> {
                if (asset.getOwnerUserId() == null || !asset.getOwnerUserId().equals(principal.userId())) {
                    throw new EntitlementDeniedException(asset.getId());
                }
            }
            case SYSTEM -> {
                if (!hasEditorOrAdmin(principal)) {
                    throw new AccessDeniedException("SYSTEM assets require EDITOR or TENANT_ADMIN");
                }
            }
            case TENANT_PUBLIC -> throw new EntitlementDeniedException(asset.getId());
            default -> throw new IllegalStateException("Unexpected scope: " + asset.getScope());
        }
    }

    private void authorizeContentAsset(MediaAsset asset, DirectwerkUserPrincipal principal) {
        moduleGateService.requireModule(DigitalContentModule.KEY);
        if (asset.getEpisodeId() != null) {
            moduleGateService.requireModule(PODCAST_MODULE);
            if (!entitlementApi.hasAccess(asset.getTenant().getId(), principal.userId(), asset.getEpisodeId())) {
                throw new EntitlementDeniedException(asset.getId());
            }
            return;
        }
        if (!entitlementApi.hasDigitalAssetAccess(
                asset.getTenant().getId(), principal.userId(), asset.getId()
        )) {
            throw new EntitlementDeniedException(asset.getId());
        }
    }

    private void authorizeRssContentAsset(MediaAsset asset, Long subscriberUserId) {
        if (subscriberUserId == null) {
            throw new EntitlementDeniedException(asset.getId());
        }
        if (asset.getScope() != AssetScope.CONTENT || asset.getEpisodeId() == null) {
            throw new EntitlementDeniedException(asset.getId());
        }

        moduleGateService.requireModule(DigitalContentModule.KEY);
        moduleGateService.requireModule(PODCAST_MODULE);
        if (!entitlementApi.hasAccess(asset.getTenant().getId(), subscriberUserId, asset.getEpisodeId())) {
            throw new EntitlementDeniedException(asset.getId());
        }
    }

    private static boolean hasEditorOrAdmin(DirectwerkUserPrincipal principal) {
        return principal.getAuthorities().stream()
                .anyMatch(authority ->
                        RoleConstants.EDITOR.equals(authority.getAuthority())
                                || RoleConstants.TENANT_ADMIN.equals(authority.getAuthority())
                );
    }
}
