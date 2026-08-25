package de.pnnit.directwerk.modules.digital.job;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.digital.storage.StorageConfigs;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.S3Object;

/**
 * Deletes staging objects and their parent session-folder markers.
 * <p>
 * Bunny Storage creates explicit folder objects for key prefixes, so removing the staging file is
 * not enough — the {@code {tenant}/staging/{session}/} marker must be deleted as well. Bunny S3 has
 * no bucket lifecycle policies, so abandoned staging objects (failed uploads, unconfirmed assets)
 * are purged by {@link #cleanupExpiredStaging()} instead.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
public class StagingCleanupService {

    private final S3Client s3Client;
    private final DirectwerkConfig directwerkConfig;
    private final TenantRepository tenantRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final PlatformTransactionManager transactionManager;

    /**
     * Deletes a staging object and the folder markers of its parent session directory.
     * <p>
     * Bunny represents directories as zero-byte objects, so the session folder is deleted both with
     * and without a trailing slash to cover either representation. Missing objects are ignored.
     *
     * @param bucket     the bucket containing the staging object
     * @param stagingKey the full staging key (e.g. {@code {tenant}/staging/{session}/{filename}})
     */
    public void deleteStagingKeyAndFolder(String bucket, String stagingKey) {
        if (stagingKey == null || !stagingKey.contains("/staging/")) {
            throw new IllegalArgumentException("Not a staging key: " + stagingKey);
        }
        deleteObjectQuietly(bucket, stagingKey);
        String folderKey = sessionFolderKey(stagingKey);
        deleteObjectQuietly(bucket, folderKey);
        deleteObjectQuietly(bucket, stripTrailingSlash(folderKey));
    }

    /**
     * Purges expired staging objects across all tenants.
     * <p>
     * S3 listing/deletion runs without a database transaction; each tenant's archive updates commit
     * in their own transaction so a failure for one tenant never abandons or undoes another's work.
     */
    public void cleanupExpiredStaging() {
        DirectwerkProperties.Storage storage = StorageConfigs.requireEnabled(directwerkConfig);
        long cutoffMillis = Instant.now()
                .minus(storage.stagingLifecycleHours(), ChronoUnit.HOURS)
                .toEpochMilli();

        for (Tenant tenant : tenantRepository.findAll()) {
            try {
                cleanupTenantStaging(storage, tenant, cutoffMillis);
            } catch (Exception ex) {
                log.warn("Staging cleanup failed for tenant {} — will retry on next sweep", tenant.getSlug(), ex);
            }
        }
    }

    private void cleanupTenantStaging(
            DirectwerkProperties.Storage storage,
            Tenant tenant,
            long cutoffMillis
    ) {
        String prefix = tenant.getSlug() + "/staging/";
        String continuationToken = null;
        do {
            List<String> deletedFileKeys = new ArrayList<>();
            ListObjectsV2Request.Builder request = ListObjectsV2Request.builder()
                    .bucket(storage.bucket())
                    .prefix(prefix);
            if (continuationToken != null) {
                request.continuationToken(continuationToken);
            }
            ListObjectsV2Response response = s3Client.listObjectsV2(request.build());
            for (S3Object object : response.contents()) {
                if (object.lastModified() == null || object.lastModified().toEpochMilli() >= cutoffMillis) {
                    continue;
                }
                deleteObjectQuietly(storage.bucket(), object.key());
                if (!object.key().endsWith("/")) {
                    deletedFileKeys.add(object.key());
                }
            }
            continuationToken = response.isTruncated() ? response.nextContinuationToken() : null;
            archivePendingAssets(tenant, deletedFileKeys);
        } while (continuationToken != null);
    }

    private void archivePendingAssets(Tenant tenant, List<String> keys) {
        if (keys.isEmpty()) {
            return;
        }
        Integer archived = new TransactionTemplate(transactionManager).execute(status -> {
            int total = 0;
            for (String key : keys) {
                total += mediaAssetRepository.archivePendingByS3Key(tenant.getId(), key);
            }
            return total;
        });
        if (archived != null && archived > 0) {
            log.info("Archived {} PENDING media asset(s) for expired staging objects tenant={}",
                    archived, tenant.getSlug());
        }
    }

    private void deleteObjectQuietly(String bucket, String key) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build());
        } catch (NoSuchKeyException ex) {
            log.debug("Staging object already absent (idempotent): {}", key);
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                log.debug("Staging object already absent (HTTP 404): {}", key);
                return;
            }
            throw ex;
        }
    }

    private static String sessionFolderKey(String stagingKey) {
        int lastSlash = stagingKey.lastIndexOf('/');
        if (lastSlash < 0) {
            throw new IllegalArgumentException("Staging key must live under a session folder: " + stagingKey);
        }
        return stagingKey.substring(0, lastSlash + 1);
    }

    private static String stripTrailingSlash(String key) {
        return key.endsWith("/") ? key.substring(0, key.length() - 1) : key;
    }

}
