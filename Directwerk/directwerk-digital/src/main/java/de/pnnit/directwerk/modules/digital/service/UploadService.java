package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.TenantAssetKeys;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.modules.digital.api.MediaFolderApi;
import de.pnnit.directwerk.modules.digital.api.UploadApi;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.MediaAssetNotFoundException;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.digital.job.MediaDeleteJobProducer;
import de.pnnit.directwerk.modules.digital.job.StagingCleanupService;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.digital.storage.StorageConfigs;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.SecurityUtils;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

/**
 * Active {@link UploadApi} when object storage is enabled.
 * <p>
 * Do not use {@code @ConditionalOnBean(S3Client.class)} here — component-scan evaluates
 * that before {@link de.pnnit.directwerk.modules.digital.storage.S3StorageConfig} registers
 * the S3 beans, which leaves no {@code UploadApi} at all (startup failure). Matching
 * {@code directwerk.storage.enabled=true} with the S3 config property is enough; DI then
 * wires {@link S3Client} / {@link S3Presigner}.
 */
@Service
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
@RequiresModule(DigitalContentModule.KEY)
public class UploadService implements UploadApi {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final MediaAssetRepository mediaAssetRepository;
    private final TenantRepository tenantRepository;
    private final DirectwerkConfig directwerkConfig;
    private final StagingCleanupService stagingCleanupService;
    private final MediaDeleteJobProducer mediaDeleteJobProducer;
    private final PlatformTransactionManager transactionManager;
    private final MediaFolderApi mediaFolderApi;
    private final MembershipPermissionService permissionService;

    /**
     * Creates a pending media asset and a presigned URL for uploading its content.
     *
     * @param command the upload metadata and intended asset scope
     * @return the asset identifier, presigned upload URL, expiration time, staging key, and required content type header
     */
    @Override
    @Transactional
    public UploadUrlResult createUploadUrl(CreateUploadUrlCommand command) {
        DirectwerkProperties.Storage storage = StorageConfigs.requireEnabled(directwerkConfig);
        Long tenantId = TenantContext.requireTenantId();
        // RBAC gate (issue #148): ambient principal — every authenticated HTTP path
        // carries one; trusted system paths run without and were authorized upstream.
        permissionService.requireContentAccess(
                SecurityUtils.currentPrincipal(),
                ContentEntityType.MEDIA_ASSET,
                ContentOperation.CREATE,
                null);
        Tenant tenant = tenantRepository.requireById(tenantId);

        MediaUploadRules.validateMimeAndSize(
                command.assetType(),
                command.mimeType(),
                command.sizeBytes(),
                MediaUploadRules.limitOverride(tenant, command.assetType()));
        String filename = MediaUploadRules.sanitizeFilename(command.filename());
        if ("bin".equals(MediaUploadRules.fileExtension(filename))) {
            String ext = MediaUploadRules.extensionForMime(command.mimeType());
            if (ext != null) {
                filename = MediaUploadRules.sanitizeFilenameStem(filename) + "." + ext;
            }
        }

        AssetVisibility intended = command.intendedVisibility() == null
                ? AssetVisibility.PRIVATE
                : command.intendedVisibility();
        AssetScope scope = command.scope() == null
                ? (intended == AssetVisibility.PUBLIC ? AssetScope.TENANT_PUBLIC : AssetScope.CONTENT)
                : command.scope();
        validateScope(scope, command.ownerUserId(), command.episodeId());
        if (intended == AssetVisibility.PUBLIC && scope != AssetScope.TENANT_PUBLIC) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "PUBLIC visibility requires scope TENANT_PUBLIC"
            );
        }
        if (intended == AssetVisibility.PRIVATE && scope == AssetScope.TENANT_PUBLIC) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "TENANT_PUBLIC scope requires PUBLIC visibility"
            );
        }

        String sessionId = UUID.randomUUID().toString();
        String stagingKey = TenantAssetKeys.stagingKey(tenant.getSlug(), sessionId + "/" + filename);

        MediaAsset asset = new MediaAsset();
        asset.setTenant(tenant);
        asset.setS3Key(stagingKey);
        asset.setVisibility(intended);
        asset.setScope(scope);
        asset.setAssetType(command.assetType());
        asset.setStatus(AssetStatus.PENDING);
        asset.setEpisodeId(command.episodeId());
        asset.setOwnerUserId(command.ownerUserId());
        asset.setCreatedBy(SecurityUtils.currentUserId());
        if (command.folderId() != null) {
            // Unknown or foreign-tenant folders surface as 404, like unknown assets.
            mediaFolderApi.assignAssetToFolder(tenantId, asset, command.folderId());
        }
        asset.setMimeType(MediaUploadRules.normalizeMime(command.mimeType()));
        asset.setSizeBytes(command.sizeBytes());
        asset.setOriginalFilename(filename);
        mediaAssetRepository.saveAndFlush(asset);

        Duration ttl = storage.presignUploadTtl() != null ? storage.presignUploadTtl() : Duration.ofMinutes(15);
        Instant expiresAt = Instant.now().plus(ttl);

        // Do not set contentLength on the PutObjectRequest used for browser/client
        // presigns — AWS SigV4 would include content-length in SignedHeaders, which
        // browsers cannot set reliably and which breaks many S3-compatible providers.
        // Declared sizeBytes is still stored and checked on confirm via HeadObject.
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(storage.bucket())
                .key(stagingKey)
                .contentType(asset.getMimeType())
                .build();

        PresignedPutObjectRequest presigned = s3Presigner.presignPutObject(PutObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .putObjectRequest(putObjectRequest)
                .build());

        return new UploadUrlResult(
                asset.getId(),
                presigned.url().toString(),
                expiresAt,
                stagingKey,
                Map.of("Content-Type", asset.getMimeType())
        );
    }

    @Override
    public ConfirmUploadResult confirmUpload(ConfirmUploadCommand command) {
        DirectwerkProperties.Storage storage = StorageConfigs.requireEnabled(directwerkConfig);
        Long tenantId = TenantContext.requireTenantId();
        Tenant tenant = tenantRepository.requireById(tenantId);

        MediaAsset asset = mediaAssetRepository.findById(command.mediaAssetId())
                .orElseThrow(() -> new MediaAssetNotFoundException(command.mediaAssetId()));
        if (!tenantId.equals(asset.getTenant().getId())) {
            throw new MediaAssetNotFoundException(command.mediaAssetId());
        }
        if (asset.getStatus() != AssetStatus.PENDING) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "Asset is not PENDING (status=" + asset.getStatus() + ")"
            );
        }
        TenantAssetKeys.requireTenantPrefix(tenant.getSlug(), asset.getS3Key());
        if (!asset.getS3Key().contains("/staging/")) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "Asset is not in staging"
            );
        }

        HeadObjectResponse head;
        try {
            head = s3Client.headObject(HeadObjectRequest.builder()
                    .bucket(storage.bucket())
                    .key(asset.getS3Key())
                    .build());
        } catch (NoSuchKeyException ex) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "Staging object not found — upload may not have completed",
                    ex
            );
        }

        if (asset.getSizeBytes() != null && head.contentLength() != null
                && !asset.getSizeBytes().equals(head.contentLength())) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "Uploaded size does not match declared sizeBytes"
            );
        }
        if (asset.getMimeType() != null && head.contentType() != null
                && !asset.getMimeType().equalsIgnoreCase(head.contentType().split(";")[0].trim())) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "Uploaded Content-Type does not match declared mimeType"
            );
        }

        String finalKey = buildFinalKey(tenant.getSlug(), asset);
        String stagingKey = asset.getS3Key();

        s3Client.copyObject(CopyObjectRequest.builder()
                .sourceBucket(storage.bucket())
                .sourceKey(stagingKey)
                .destinationBucket(storage.bucket())
                .destinationKey(finalKey)
                .build());

        MediaAsset confirmed;
        try {
            confirmed = new TransactionTemplate(transactionManager).execute(status -> {
                MediaAsset locked = mediaAssetRepository.findByIdForUpdate(command.mediaAssetId())
                        .orElseThrow(() -> new MediaAssetNotFoundException(command.mediaAssetId()));
                if (!tenantId.equals(locked.getTenant().getId())) {
                    throw new MediaAssetNotFoundException(command.mediaAssetId());
                }
                if (locked.getStatus() != AssetStatus.PENDING) {
                    throw new UploadValidationException(
                            "UPLOAD_VALIDATION_FAILED",
                            "Asset is not PENDING (status=" + locked.getStatus() + ")"
                    );
                }
                if (head.contentLength() != null) {
                    locked.setSizeBytes(head.contentLength());
                }
                if (head.eTag() != null) {
                    locked.setChecksumSha256(head.eTag().replace("\"", ""));
                }
                locked.setS3Key(finalKey);
                locked.setStatus(AssetStatus.READY);
                return mediaAssetRepository.saveAndFlush(locked);
            });
        } catch (UploadValidationException conflictEx) {
            // A concurrent confirm won the claim. The deterministic final key
            // means the object it references is identical — do NOT delete it.
            throw conflictEx;
        } catch (RuntimeException copyFollowupFailure) {
            // The DB transition failed after our copy succeeded: the object is
            // unreferenced and would otherwise leak forever (staging sweeps
            // only cover {tenant}/staging/**). Best-effort removal.
            deleteObjectQuietly(storage.bucket(), finalKey);
            throw copyFollowupFailure;
        }

        cleanupStagingObject(storage.bucket(), stagingKey);

        return new ConfirmUploadResult(
                confirmed.getId(),
                confirmed.getS3Key(),
                confirmed.getStatus().name(),
                confirmed.getVisibility(),
                confirmed.getSizeBytes(),
                confirmed.getMimeType()
        );
    }

    /**
     * Best-effort removal of the staging object and its session folder after a successful copy.
     * <p>
     * If S3 is temporarily unavailable the asset is already durably copied to its final key, so the
     * confirm must not roll back — a {@code MEDIA_STAGING_CLEANUP} job retries the delete later.
     */
    private void cleanupStagingObject(String bucket, String stagingKey) {
        try {
            stagingCleanupService.deleteStagingKeyAndFolder(bucket, stagingKey);
        } catch (SdkException ex) {
            log.warn("Staging cleanup deferred after copy — S3 unavailable for key {}", stagingKey, ex);
            mediaDeleteJobProducer.enqueueStagingCleanup(stagingKey);
        }
    }

    /** Best-effort delete of an orphaned copied object; never masks the original failure. */
    private void deleteObjectQuietly(String bucket, String key) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build());
        } catch (Exception cleanupEx) {
            log.warn("Failed to clean up unreferenced object after failed confirm: {}", key, cleanupEx);
        }
    }

    private static String buildFinalKey(String tenantSlug, MediaAsset asset) {
        String visibilityFolder = asset.getVisibility() == AssetVisibility.PUBLIC ? "public" : "private";
        String typeFolder = MediaUploadRules.typeFolder(asset.getAssetType());
        String filename = asset.getOriginalFilename() != null ? asset.getOriginalFilename() : "file.bin";
        String ext = MediaUploadRules.fileExtension(filename);
        String stem = MediaUploadRules.sanitizeFilenameStem(filename);
        // Deterministic per-asset object name: concurrent/duplicated confirm
        // calls copy to the SAME key (idempotent overwrite) instead of leaving
        // orphaned copies under unreferenced random keys.
        String objectName = "asset-" + asset.getId() + "_" + stem + "." + ext;
        if (asset.getScope() == AssetScope.USER && asset.getOwnerUserId() != null) {
            return TenantAssetKeys.privateKey(
                    tenantSlug,
                    "user/" + asset.getOwnerUserId() + "/" + objectName
            );
        }
        if (asset.getScope() == AssetScope.SYSTEM) {
            return TenantAssetKeys.privateKey(tenantSlug, "system/" + typeFolder + "/" + objectName);
        }
        String relative = typeFolder + "/" + objectName;
        return visibilityFolder.equals("public")
                ? TenantAssetKeys.publicKey(tenantSlug, relative)
                : TenantAssetKeys.privateKey(tenantSlug, relative);
    }

    private static void validateScope(AssetScope scope, Long ownerUserId, Long episodeId) {
        AssetScope effective = scope == null ? AssetScope.CONTENT : scope;
        if (effective == AssetScope.SYSTEM) {
            // SYSTEM assets are server-owned (never minted via the upload API): the SYSTEM
            // branch in AssetAccessService/MediaAssetLifecycleService bypasses CONTENT
            // entitlement checks, so editors must not be able to opt into it.
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "scope SYSTEM is not available for uploads"
            );
        }
        if (effective == AssetScope.USER && ownerUserId == null) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "ownerUserId is required when scope is USER"
            );
        }
        if (effective == AssetScope.TENANT_PUBLIC && episodeId != null) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "episodeId is not valid for TENANT_PUBLIC scope"
            );
        }
    }

}
