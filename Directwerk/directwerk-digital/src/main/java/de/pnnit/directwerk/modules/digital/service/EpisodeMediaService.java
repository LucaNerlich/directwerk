package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.util.TenantAssetKeys;
import de.pnnit.directwerk.modules.digital.api.CdnPurgeClient;
import de.pnnit.directwerk.modules.digital.api.EpisodeMediaApi;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import de.pnnit.directwerk.modules.digital.storage.StorageConfigs;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.S3PublicUrlBuilder;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.net.URL;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

@Service
@RequiredArgsConstructor
@Slf4j
public class EpisodeMediaService implements EpisodeMediaApi {

    private final MediaAssetRepository mediaAssetRepository;
    private final ObjectProvider<S3Client> s3ClientProvider;
    private final ObjectProvider<S3PublicUrlBuilder> publicUrlBuilderProvider;
    private final ObjectProvider<CdnPurgeClient> cdnPurgeClientProvider;
    private final DirectwerkConfig directwerkConfig;
    private final PlatformTransactionManager transactionManager;

    @Override
    @Transactional(readOnly = true)
    public MediaAsset requireReadyAudio(Long assetId) {
        MediaAsset asset = requireTenantAsset(assetId);
        if (asset.getStatus() != AssetStatus.READY) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "Audio asset must be READY");
        }
        if (asset.getAssetType() != AssetType.AUDIO) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "Asset must be AUDIO");
        }
        return asset;
    }

    @Override
    @Transactional
    public void attachEpisode(Long assetId, Long episodeId) {
        if (episodeId == null) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "episodeId is required");
        }
        MediaAsset asset = requireTenantAsset(assetId);
        asset.setEpisodeId(episodeId);
        mediaAssetRepository.save(asset);
    }

    @Override
    public MediaAsset promoteToPublic(Long assetId) {
        MediaAsset asset = requireReadyAudio(assetId);
        if (asset.getVisibility() == AssetVisibility.PUBLIC) {
            return asset;
        }

        String publicKey = publicKeyFor(asset);
        if (directwerkConfig.isStorageEnabled()) {
            S3Client s3Client = s3ClientProvider.getIfAvailable();
            if (s3Client == null) {
                throw new StorageNotConfiguredException("Object storage client is not available");
            }
            DirectwerkProperties.Storage storage = StorageConfigs.requireEnabled(directwerkConfig);
            s3Client.copyObject(CopyObjectRequest.builder()
                    .sourceBucket(storage.bucket())
                    .sourceKey(asset.getS3Key())
                    .destinationBucket(storage.bucket())
                    .destinationKey(publicKey)
                    .build());
        }

        MediaAsset updated;
        try {
            updated = new TransactionTemplate(transactionManager).execute(status -> {
                MediaAsset managed = requireTenantAsset(assetId);
                managed.setS3Key(publicKey);
                managed.setVisibility(AssetVisibility.PUBLIC);
                managed.setScope(AssetScope.TENANT_PUBLIC);
                return mediaAssetRepository.save(managed);
            });
        } catch (RuntimeException promoteFailure) {
            // The metadata transition failed after our copy succeeded: without
            // cleanup the copied object would sit untracked under the public
            // prefix while the DB still says PRIVATE. Best-effort removal.
            if (directwerkConfig.isStorageEnabled()) {
                DirectwerkProperties.Storage storage = StorageConfigs.requireEnabled(directwerkConfig);
                try {
                    s3ClientProvider.getIfAvailable().deleteObject(DeleteObjectRequest.builder()
                            .bucket(storage.bucket())
                            .key(publicKey)
                            .build());
                } catch (Exception cleanupEx) {
                    // Never mask the original failure.
                }
            }
            throw promoteFailure;
        }

        return updated;
    }

    @Override
    public MediaAsset demoteToPrivate(Long assetId) {
        MediaAsset asset = requireTenantAsset(assetId);
        if (asset.getVisibility() == AssetVisibility.PRIVATE) {
            return asset;
        }

        String publicKey = asset.getS3Key();
        String privateKey = privateKeyFor(asset);
        boolean keysDiffer = !privateKey.equals(publicKey);

        S3Client s3Client = null;
        DirectwerkProperties.Storage storage = null;
        if (directwerkConfig.isStorageEnabled() && keysDiffer) {
            s3Client = s3ClientProvider.getIfAvailable();
            if (s3Client == null) {
                throw new StorageNotConfiguredException("Object storage client is not available");
            }
            storage = StorageConfigs.requireEnabled(directwerkConfig);
            s3Client.copyObject(CopyObjectRequest.builder()
                    .sourceBucket(storage.bucket())
                    .sourceKey(publicKey)
                    .destinationBucket(storage.bucket())
                    .destinationKey(privateKey)
                    .build());
        }

        // Metadata transition commits first so a failure here never leaves the asset pointing at a
        // key that copy-and-delete already discarded; the old public object is only best-effort
        // cleaned up once the private key is durably persisted.
        MediaAsset updated = new TransactionTemplate(transactionManager).execute(status -> {
            MediaAsset managed = requireTenantAsset(assetId);
            managed.setS3Key(privateKey);
            managed.setVisibility(AssetVisibility.PRIVATE);
            managed.setScope(AssetScope.CONTENT);
            return mediaAssetRepository.save(managed);
        });

        if (s3Client != null) {
            try {
                s3Client.deleteObject(DeleteObjectRequest.builder()
                        .bucket(storage.bucket())
                        .key(publicKey)
                        .build());
            } catch (RuntimeException ex) {
                log.warn("Failed to delete stale public S3 object for asset {} after demoting to private", assetId, ex);
            }
        }

        // The public pull zone caches {tenant}/public/** at the CDN edge; deleting the origin object
        // alone leaves the previously-public audio reachable until cache TTL expiry. Purge the old
        // public URL so un-publishing/paywalling revokes public access immediately.
        CdnPurgeClient cdnPurgeClient = cdnPurgeClientProvider.getIfAvailable();
        S3PublicUrlBuilder publicUrlBuilder = publicUrlBuilderProvider.getIfAvailable();
        if (cdnPurgeClient != null && publicUrlBuilder != null) {
            try {
                cdnPurgeClient.purgeUrl(publicUrlBuilder.cdnUrl(publicKey));
            } catch (RuntimeException ex) {
                log.warn("Failed to purge public CDN cache for asset {} after demoting to private", assetId, ex);
            }
        }

        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<URL> publicCdnUrl(MediaAsset asset) {
        if (asset == null || asset.getId() == null) {
            return Optional.empty();
        }
        // Re-load with tenant EntityGraph — callers often pass detached assets after OSIV-off txs.
        MediaAsset managed = mediaAssetRepository.findById(asset.getId()).orElse(null);
        if (managed == null
                || managed.getVisibility() != AssetVisibility.PUBLIC
                || managed.getS3Key() == null) {
            return Optional.empty();
        }
        if (!TenantAssetKeys.isPublicKey(managed.getTenant().getSlug(), managed.getS3Key())) {
            return Optional.empty();
        }
        String normalized = managed.getS3Key().startsWith("/")
                ? managed.getS3Key().substring(1)
                : managed.getS3Key();
        S3PublicUrlBuilder publicUrlBuilder = publicUrlBuilderProvider.getIfAvailable();
        if (publicUrlBuilder == null) {
            return Optional.empty();
        }
        return Optional.of(publicUrlBuilder.cdnUrl(normalized));
    }

    private MediaAsset requireTenantAsset(Long assetId) {
        Long tenantId = TenantContext.requireTenantId();
        MediaAsset asset = mediaAssetRepository.findById(assetId)
                .orElseThrow(() -> new MediaAssetNotFoundException(assetId));
        if (!tenantId.equals(asset.getTenant().getId())) {
            throw new MediaAssetNotFoundException(assetId);
        }
        return asset;
    }

    private String publicKeyFor(MediaAsset asset) {
        String tenantSlug = asset.getTenant().getSlug();
        String key = TenantAssetKeys.requireTenantPrefix(tenantSlug, asset.getS3Key());
        String privatePrefix = tenantSlug + "/private/";
        String publicPrefix = tenantSlug + "/public/";
        if (key.startsWith(publicPrefix)) {
            return key;
        }
        if (!key.startsWith(privatePrefix)) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "Private audio asset must live under the tenant private prefix"
            );
        }
        return publicPrefix + key.substring(privatePrefix.length());
    }

    private String privateKeyFor(MediaAsset asset) {
        String tenantSlug = asset.getTenant().getSlug();
        String key = TenantAssetKeys.requireTenantPrefix(tenantSlug, asset.getS3Key());
        String privatePrefix = tenantSlug + "/private/";
        String publicPrefix = tenantSlug + "/public/";
        if (key.startsWith(privatePrefix)) {
            return key;
        }
        if (!key.startsWith(publicPrefix)) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "Public audio asset must live under the tenant public prefix"
            );
        }
        return privatePrefix + key.substring(publicPrefix.length());
    }


}
