package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.FeatureModuleKeys;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.util.TenantAssetKeys;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.api.AssetAccessApi;
import de.pnnit.directwerk.modules.content.api.EntitlementApi;
import de.pnnit.directwerk.modules.digital.entity.AccessPolicy;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.DigitalPublication;
import de.pnnit.directwerk.modules.digital.entity.DigitalPublicationStatus;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.EntitlementDeniedException;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.repository.DigitalPublicationRepository;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.PrivateObjectUrlSigner;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.net.URL;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves public CDN URLs and private signed GET URLs after authorization.
 * Private delivery policy (Bunny token auth vs S3 presign) is delegated to
 * {@link PrivateObjectUrlSigner}.
 */
@Service
@RequiredArgsConstructor
public class AssetAccessService implements AssetAccessApi {

    private final EntitlementApi entitlementApi;
    private final ModuleGateService moduleGateService;
    private final PublicCdnUrlResolver publicCdnUrlResolver;
    private final PrivateObjectUrlSigner privateObjectUrlSigner;
    private final DirectwerkConfig directwerkConfig;
    private final MediaAssetRepository mediaAssetRepository;
    private final DigitalPublicationRepository digitalPublicationRepository;

    @Override
    @Transactional(readOnly = true)
    public URL resolveDownloadUrl(MediaAsset asset, DirectwerkUserPrincipal principal) {
        MediaAsset managed = requireLoadedAsset(asset);
        MediaAssetTenantCheck.assertTenantMatch(managed);
        TenantAssetKeys.requireTenantPrefix(managed.getTenant().getSlug(), managed.getS3Key());

        if (managed.getVisibility() == AssetVisibility.PUBLIC) {
            return resolvePublicCdnUrl(managed);
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
            return resolvePublicCdnUrl(managed);
        }

        authorizeRssContentAsset(managed, subscriberUserId);
        return resolvePrivateDownloadUrl(managed, rssDownloadTtl());
    }

    @Override
    @Transactional(readOnly = true)
    public URL resolveEpisodePortalUrl(
            MediaAsset asset,
            Long episodeId,
            AccessPolicy accessPolicy,
            DirectwerkUserPrincipal principal
    ) {
        if (accessPolicy == AccessPolicy.PAID) {
            moduleGateService.requireModule(FeatureModuleKeys.SUBSCRIPTION);
        }
        return resolveDownloadUrl(asset, principal);
    }

    @Override
    @Transactional(readOnly = true)
    public URL resolvePreviewUrl(MediaAsset asset, DirectwerkUserPrincipal principal, boolean previewDraft) {
        MediaAsset managed = requireLoadedAsset(asset);
        MediaAssetTenantCheck.assertTenantMatch(managed);
        TenantAssetKeys.requireTenantPrefix(managed.getTenant().getSlug(), managed.getS3Key());

        if (principal == null || !RoleConstants.isEditorOrTenantAdmin(principal)) {
            throw new AccessDeniedException("Preview requires EDITOR or TENANT_ADMIN");
        }

        if (managed.getVisibility() == AssetVisibility.PUBLIC) {
            return resolvePublicCdnUrl(managed);
        }

        // Publisher in-tenant preview: editors bypass CONTENT entitlements (including drafts)
        if (previewDraft || managed.getStatus() == AssetStatus.PENDING || managed.getStatus() == AssetStatus.READY) {
            authorizePrivateAsset(managed, principal, true);
            return resolvePrivateDownloadUrl(managed, apiDownloadTtl());
        }

        throw new EntitlementDeniedException(managed.getId());
    }

    /**
     * Batch downloads: public assets resolve directly; standalone private CONTENT assets share
     * ONE batched entitlement evaluation, unioned with the publication-policy gate for assets
     * referenced by published bonus publications. Denied assets are skipped, never leaked.
     */
    @Override
    @Transactional(readOnly = true)
    public List<AssetAccessApi.ResolvedDownload> resolveDownloadUrls(
            Collection<MediaAsset> assets,
            DirectwerkUserPrincipal principal
    ) {
        if (assets.isEmpty() || principal == null) {
            return List.of();
        }
        List<Long> ids = assets.stream()
                .map(MediaAsset::getId)
                .filter(Objects::nonNull)
                .toList();
        Map<Long, MediaAsset> managedById = mediaAssetRepository.findAllWithTenantByIdIn(ids).stream()
                .collect(Collectors.toMap(MediaAsset::getId, m -> m, (a, b) -> a));

        List<AssetAccessApi.ResolvedDownload> resolved = new ArrayList<>();
        List<MediaAsset> privateStandalone = new ArrayList<>();
        for (MediaAsset input : assets) {
            MediaAsset managed = input.getId() == null ? null : managedById.get(input.getId());
            if (managed == null || isTombstoned(managed)) {
                continue;
            }
            MediaAssetTenantCheck.assertTenantMatch(managed);
            TenantAssetKeys.requireTenantPrefix(managed.getTenant().getSlug(), managed.getS3Key());
            if (managed.getVisibility() == AssetVisibility.PUBLIC) {
                resolved.add(new AssetAccessApi.ResolvedDownload(managed, resolvePublicCdnUrl(managed)));
            } else if (managed.getScope() == AssetScope.CONTENT && managed.getEpisodeId() == null) {
                privateStandalone.add(managed);
            } else {
                try {
                    resolved.add(new AssetAccessApi.ResolvedDownload(
                            managed, resolveDownloadUrl(managed, principal)));
                } catch (EntitlementDeniedException | AccessDeniedException ignored) {
                    // Fail closed per asset — do not leak unauthorized files.
                }
            }
        }

        if (!privateStandalone.isEmpty()) {
            moduleGateService.requireModule(DigitalContentModule.KEY);
            Long tenantId = privateStandalone.getFirst().getTenant().getId();
            List<Long> assetIds = privateStandalone.stream().map(MediaAsset::getId).toList();
            Set<Long> allowed = new HashSet<>(entitlementApi.filterAccessibleDigitalAssets(
                    tenantId, principal.userId(), assetIds));
            // Published bonus publications carry their own FREE/LEVEL access policy: it grants
            // the asset without a PACKAGE DIGITAL_ASSET rule (union — either grant is enough,
            // everything else stays denied).
            allowed.addAll(entitlementApi.filterAccessiblePublicationAssets(
                    tenantId, principal.userId(), publicationAccessPolicies(tenantId, assetIds)));
            for (MediaAsset asset : privateStandalone) {
                if (allowed.contains(asset.getId())) {
                    resolved.add(new AssetAccessApi.ResolvedDownload(
                            asset, resolvePrivateDownloadUrl(asset, apiDownloadTtl())));
                }
            }
        }
        return resolved;
    }

    /**
     * Published bonus publications grant their own asset: FREE to every subscriber, PAID at the
     * configured LEVEL sort order. Multiple publications may reference one asset — the most
     * permissive policy wins (union).
     */
    private Map<Long, EntitlementApi.PublicationAccessPolicy> publicationAccessPolicies(Long tenantId, List<Long> assetIds) {
        Map<Long, EntitlementApi.PublicationAccessPolicy> policiesByAssetId = new HashMap<>();
        for (DigitalPublication publication : digitalPublicationRepository
                .findByTenantIdAndStatusAndAssetIdIn(tenantId, DigitalPublicationStatus.PUBLISHED, assetIds)) {
            EntitlementApi.PublicationAccessPolicy policy = new EntitlementApi.PublicationAccessPolicy(
                    publication.getAccessPolicy() == AccessPolicy.FREE,
                    publication.getRequiredLevelSortOrder() == null
                            ? 0
                            : publication.getRequiredLevelSortOrder()
            );
            policiesByAssetId.merge(publication.getAsset().getId(), policy, AssetAccessService::mostPermissive);
        }
        return policiesByAssetId;
    }

    private static EntitlementApi.PublicationAccessPolicy mostPermissive(
            EntitlementApi.PublicationAccessPolicy left,
            EntitlementApi.PublicationAccessPolicy right
    ) {
        if (left.free()) {
            return left;
        }
        if (right.free()) {
            return right;
        }
        return left.requiredLevelSortOrder() <= right.requiredLevelSortOrder() ? left : right;
    }

    private URL resolvePublicCdnUrl(MediaAsset asset) {
        return publicCdnUrlResolver.resolve(asset)
                .orElseThrow(() -> new EntitlementDeniedException(asset.getId()));
    }

    private MediaAsset requireLoadedAsset(MediaAsset asset) {
        if (asset == null || asset.getId() == null) {
            throw new MediaAssetNotFoundException(asset != null ? asset.getId() : null);
        }
        MediaAsset managed = mediaAssetRepository.findById(asset.getId())
                .orElseThrow(() -> new MediaAssetNotFoundException(asset.getId()));
        if (isTombstoned(managed)) {
            // Deletion is meant to be immediate and irreversible (MediaAssetLifecycleApi's own
            // "already-archived -> 404" contract); don't keep serving a tombstoned asset to
            // already-entitled readers during the async S3-purge window.
            throw new MediaAssetNotFoundException(asset.getId());
        }
        return managed;
    }

    private static boolean isTombstoned(MediaAsset asset) {
        return asset.getStatus() == AssetStatus.PENDING_DELETE || asset.getStatus() == AssetStatus.ARCHIVED;
    }

    /**
     * Private object delivery: delegated to {@link PrivateObjectUrlSigner} — one home for
     * the Bunny-token vs S3-presign policy across API downloads and RSS delivery.
     */
    private URL resolvePrivateDownloadUrl(MediaAsset asset, Duration ttl) {
        return privateObjectUrlSigner.signPrivateObject(asset.getS3Key(), ttl);
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
                if (publisherPreview && RoleConstants.isEditorOrTenantAdmin(principal)) {
                    moduleGateService.requireModule(DigitalContentModule.KEY);
                    if (asset.getEpisodeId() != null) {
                        // authorizeContentAsset requires this for the ordinary download path;
                        // the preview bypass must not skip it for the same episode-linked asset.
                        moduleGateService.requireModule(FeatureModuleKeys.PODCAST);
                    }
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
                if (!RoleConstants.isEditorOrTenantAdmin(principal)) {
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
            moduleGateService.requireModule(FeatureModuleKeys.PODCAST);
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
        moduleGateService.requireModule(FeatureModuleKeys.PODCAST);
        if (!entitlementApi.hasAccess(asset.getTenant().getId(), subscriberUserId, asset.getEpisodeId())) {
            throw new EntitlementDeniedException(asset.getId());
        }
    }

}
