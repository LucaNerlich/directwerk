package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.util.TenantAssetKeys;
import de.pnnit.directwerk.modules.digital.DigitalContentModule;
import de.pnnit.directwerk.modules.digital.api.RemoteAssetIngestApi;
import de.pnnit.directwerk.modules.digital.entity.AssetScope;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.digital.job.RemoteAssetIngestJobPayload;
import de.pnnit.directwerk.modules.digital.job.RemoteAssetIngestJobProducer;
import de.pnnit.directwerk.modules.digital.net.RemoteContentClient;
import de.pnnit.directwerk.modules.digital.net.RemoteUrlValidator;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.StorageConfigs;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.AbortMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CompleteMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CompletedMultipartUpload;
import software.amazon.awssdk.services.s3.model.CompletedPart;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadRequest;
import software.amazon.awssdk.services.s3.model.CreateMultipartUploadResponse;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.UploadPartRequest;

/**
 * Streams a remote HTTP body into the tenant bucket. Never materializes the full object in heap.
 */
@Service
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
@RequiresModule(DigitalContentModule.KEY)
public class RemoteAssetIngestService implements RemoteAssetIngestApi {

    private static final int MULTIPART_PART_SIZE = 8 * 1024 * 1024;
    private static final long PROGRESS_REPORT_INTERVAL_BYTES = 256 * 1024;
    private static final Duration INGEST_TIMEOUT = Duration.ofMinutes(15);
    private static final List<AssetStatus> REUSABLE_IMPORT_STATUSES = List.of(AssetStatus.READY, AssetStatus.PENDING);

    private final S3Client s3Client;
    private final RemoteContentClient remoteContentClient;
    private final MediaAssetRepository mediaAssetRepository;
    private final TenantRepository tenantRepository;
    private final DirectwerkConfig directwerkConfig;
    private final PlatformTransactionManager transactionManager;
    private final RemoteAssetIngestJobProducer remoteAssetIngestJobProducer;

    /**
     * Imports a remote HTTP(S) asset into the active tenant's storage.
     *
     * @param command the source URL and asset metadata for the import
     * @return the persisted media asset after successful upload
     */
    @Override
    public MediaAsset ingestFromUrl(IngestCommand command) {
        Optional<MediaAsset> reusable = findReusableImport(command);
        if (reusable.isPresent()) {
            return reusable.get();
        }
        return completePreparedIngest(prepareIngest(command), null);
    }

    /**
     * Creates a pending asset and enqueues a durable background ingest job.
     *
     * @param command the source URL and asset metadata for the import
     * @return the pending media asset whose progress can be polled via {@code GET /api/v1/podcast/import/assets/{id}}
     */
    @Override
    public MediaAsset startIngestFromUrl(IngestCommand command) {
        Optional<MediaAsset> reusable = findReusableImport(command);
        if (reusable.isPresent()) {
            return reusable.get();
        }
        remoteAssetIngestJobProducer.validateQueueAvailability();
        PreparedIngest prepared = transactionTemplate().execute(status -> {
            PreparedIngest pending = prepareIngest(command);
            MediaAsset asset = pending.asset();
            remoteAssetIngestJobProducer.enqueue(
                    asset.getId(),
                    command.sourceUrl(),
                    command.filenameHint()
            );
            return pending;
        });
        if (prepared == null) {
            throw new UploadValidationException("REMOTE_ASSET_FAILED", "Could not prepare remote asset ingest");
        }
        return prepared.asset();
    }

    /**
     * Processes a queued remote ingest job. Retries transient failures until the queue exhausts attempts.
     */
    public void processQueuedIngest(RemoteAssetIngestJobPayload payload, QueueJob job) {
        MediaAsset asset = mediaAssetRepository.findById(payload.mediaAssetId()).orElse(null);
        if (asset == null || asset.getStatus() != AssetStatus.PENDING) {
            log.info(
                    "Skipping remote ingest job for asset {} (missing or status={})",
                    payload.mediaAssetId(),
                    asset == null ? "missing" : asset.getStatus()
            );
            return;
        }
        Long tenantId = job.tenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Remote asset ingest job requires tenantId");
        }
        URI source = RemoteUrlValidator.requirePublicHttpUrl(payload.sourceUrl());
        PreparedIngest prepared = new PreparedIngest(
                StorageConfigs.requireEnabled(directwerkConfig),
                source,
                new IngestCommand(
                        payload.sourceUrl(),
                        asset.getAssetType(),
                        asset.getVisibility(),
                        payload.filenameHint()
                ),
                asset.getAssetType(),
                asset
        );
        try {
            completePreparedIngest(
                    prepared,
                    bytesRead -> reportIngestProgress(asset.getId(), tenantId, bytesRead)
            );
        } catch (UploadValidationException ex) {
            if (isPermanentIngestFailure(ex)) {
                log.warn(
                        "Remote ingest validation failed for asset {}: {}",
                        payload.mediaAssetId(),
                        ex.getMessage()
                );
                markIngestFailed(payload.mediaAssetId(), tenantId);
                return;
            }
            maybeMarkIngestFailedOnFinalAttempt(job, payload.mediaAssetId(), tenantId);
            throw ex;
        } catch (RuntimeException ex) {
            log.warn(
                    "Remote ingest failed for asset {}: {}",
                    payload.mediaAssetId(),
                    ex.getMessage(),
                    ex
            );
            maybeMarkIngestFailedOnFinalAttempt(job, payload.mediaAssetId(), tenantId);
            throw ex;
        }
    }

    private static boolean isPermanentIngestFailure(UploadValidationException ex) {
        String code = ex.getCode();
        return "UPLOAD_VALIDATION_FAILED".equals(code) || "REMOTE_URL_FORBIDDEN".equals(code);
    }

    private void maybeMarkIngestFailedOnFinalAttempt(QueueJob job, Long assetId, Long tenantId) {
        if (job.attempts() >= job.maxAttempts()) {
            markIngestFailed(assetId, tenantId);
        }
    }

    private PreparedIngest prepareIngest(IngestCommand command) {
        StorageConfigs.requireEnabled(directwerkConfig);
        Long tenantId = TenantContext.requireTenantId();
        Tenant tenant = tenantRepository.requireById(tenantId);
        URI source = RemoteUrlValidator.requirePublicHttpUrl(command.sourceUrl());
        String canonicalSource = RemoteUrlValidator.canonicalImportSourceUrl(source);
        AssetType assetType = command.assetType();
        if (assetType == null) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "assetType is required");
        }
        AssetVisibility visibility = command.intendedVisibility() == null
                ? AssetVisibility.PRIVATE
                : command.intendedVisibility();
        AssetScope scope = visibility == AssetVisibility.PUBLIC ? AssetScope.TENANT_PUBLIC : AssetScope.CONTENT;
        String filename = resolveFilename(command.filenameHint(), source);

        MediaAsset asset = new MediaAsset();
        asset.setTenant(tenant);
        asset.setVisibility(visibility);
        asset.setScope(scope);
        asset.setAssetType(assetType);
        asset.setStatus(AssetStatus.PENDING);
        asset.setOriginalFilename(filename);
        asset.setImportSourceUrl(canonicalSource);
        asset.setS3Key(TenantAssetKeys.stagingKey(tenant.getSlug(), UUID.randomUUID() + "/" + filename));
        mediaAssetRepository.saveAndFlush(asset);

        String finalKey = buildFinalKey(tenant.getSlug(), asset);
        asset.setS3Key(finalKey);
        mediaAssetRepository.saveAndFlush(asset);

        return new PreparedIngest(
                StorageConfigs.requireEnabled(directwerkConfig),
                source,
                command,
                assetType,
                asset
        );
    }

    private Optional<MediaAsset> findReusableImport(IngestCommand command) {
        StorageConfigs.requireEnabled(directwerkConfig);
        Long tenantId = TenantContext.requireTenantId();
        AssetType assetType = command.assetType();
        if (assetType == null) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "assetType is required");
        }
        String canonicalSource = RemoteUrlValidator.canonicalImportSourceUrl(command.sourceUrl());
        return mediaAssetRepository.findFirstByTenant_IdAndImportSourceUrlAndAssetTypeAndStatusInOrderByIdDesc(
                tenantId,
                canonicalSource,
                assetType,
                REUSABLE_IMPORT_STATUSES
        );
    }

    private MediaAsset completePreparedIngest(
            PreparedIngest prepared,
            java.util.function.LongConsumer progressReporter
    ) {
        try (RemoteContentClient.RemoteResponse remote = remoteContentClient.get(prepared.source(), INGEST_TIMEOUT)) {
            if (remote.statusCode() < 200 || remote.statusCode() >= 300) {
                throw new UploadValidationException(
                        "REMOTE_ASSET_FAILED",
                        "Remote asset returned HTTP " + remote.statusCode()
                );
            }
            String filename = resolveFilename(prepared.command().filenameHint(), remote.finalUri());
            String mimeType = resolveMime(prepared.assetType(), remote.contentType(), filename);
            long maxBytes = MediaUploadRules.maxBytes(prepared.assetType());
            if (remote.contentLength() != null && remote.contentLength() > maxBytes) {
                throw new UploadValidationException(
                        "UPLOAD_VALIDATION_FAILED",
                        "Remote asset exceeds max size for " + prepared.assetType()
                );
            }

            MediaAsset asset = prepared.asset();
            if (!filename.equals(asset.getOriginalFilename())) {
                asset.setOriginalFilename(filename);
                asset.setS3Key(buildFinalKey(asset.getTenant().getSlug(), asset));
            }
            asset.setMimeType(mimeType);
            asset.setSizeBytes(remote.contentLength());
            asset.setOriginalFilename(filename);
            asset.setBytesTransferred(0L);
            mediaAssetRepository.saveAndFlush(asset);

            try {
                ProgressTrackingInputStream limited = new ProgressTrackingInputStream(
                        remote.body(),
                        maxBytes,
                        progressReporter
                );
                long written = streamToS3(
                        prepared.storage().bucket(),
                        asset.getS3Key(),
                        mimeType,
                        remote.contentLength(),
                        limited
                );
                if (progressReporter != null) {
                    progressReporter.accept(written);
                }
                asset.setSizeBytes(written);
                asset.setBytesTransferred(written);
                asset.setStatus(AssetStatus.READY);
                return mediaAssetRepository.saveAndFlush(asset);
            } catch (RuntimeException | IOException ex) {
                deleteObjectQuietly(prepared.storage().bucket(), asset.getS3Key());
                if (progressReporter == null) {
                    mediaAssetRepository.delete(asset);
                }
                if (ex instanceof RuntimeException runtimeEx) {
                    throw runtimeEx;
                }
                throw new UploadValidationException("REMOTE_ASSET_FAILED", "Could not stream remote asset", ex);
            }
        } catch (UploadValidationException ex) {
            throw ex;
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new UploadValidationException("REMOTE_ASSET_FAILED", "Could not stream remote asset", ex);
        }
    }

    void reportIngestProgress(Long assetId, Long tenantId, long bytesTransferred) {
        if (assetId == null || tenantId == null) {
            return;
        }
        TenantContext.callWithTenant(tenantId, () -> {
            transactionTemplate().executeWithoutResult(status ->
                    mediaAssetRepository.updateBytesTransferred(assetId, bytesTransferred));
            return null;
        });
    }

    private void markIngestFailed(Long assetId, Long tenantId) {
        try {
            TenantContext.callWithTenant(tenantId, () -> {
                transactionTemplate().executeWithoutResult(status -> {
                    MediaAsset asset = mediaAssetRepository.findById(assetId).orElse(null);
                    if (asset == null || asset.getStatus() != AssetStatus.PENDING || asset.getEpisodeId() != null) {
                        return;
                    }
                    DirectwerkProperties.Storage storage = StorageConfigs.requireEnabled(directwerkConfig);
                    deleteObjectQuietly(storage.bucket(), asset.getS3Key());
                    asset.setStatus(AssetStatus.ARCHIVED);
                    mediaAssetRepository.save(asset);
                });
                return null;
            });
        } catch (RuntimeException ex) {
            log.warn("Failed to mark remote ingest asset {} as failed", assetId, ex);
        }
    }

    private TransactionTemplate transactionTemplate() {
        return new TransactionTemplate(transactionManager);
    }

    private record PreparedIngest(
            DirectwerkProperties.Storage storage,
            URI source,
            IngestCommand command,
            AssetType assetType,
            MediaAsset asset
    ) {
    }

    /**
     * Discards an unattached remote asset belonging to the active tenant.
     *
     * @param assetId the identifier of the remote asset to discard
     */
    @Override
    public void discard(Long assetId) {
        if (assetId == null) {
            return;
        }
        DirectwerkProperties.Storage storage = StorageConfigs.requireEnabled(directwerkConfig);
        Long tenantId = TenantContext.requireTenantId();
        MediaAsset asset = mediaAssetRepository.findById(assetId).orElse(null);
        if (asset == null) {
            return;
        }
        if (!tenantId.equals(asset.getTenant().getId())) {
            throw new UploadValidationException("REMOTE_ASSET_FAILED", "Remote asset does not belong to tenant");
        }
        if (asset.getEpisodeId() != null) {
            throw new UploadValidationException("REMOTE_ASSET_FAILED", "Attached remote asset cannot be discarded");
        }

        String key = asset.getS3Key();
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(storage.bucket())
                    .key(key)
                    .build());
        } catch (RuntimeException ex) {
            throw new UploadValidationException("REMOTE_ASSET_FAILED", "Could not discard remote asset", ex);
        }
        mediaAssetRepository.delete(asset);
    }

    private long streamToS3(
            String bucket,
            String key,
            String mimeType,
            Long declaredLength,
            ProgressTrackingInputStream body
    ) throws IOException {
        if (declaredLength != null && declaredLength > 0 && declaredLength <= MULTIPART_PART_SIZE) {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(mimeType)
                            .contentLength(declaredLength)
                            .build(),
                    RequestBody.fromInputStream(body, declaredLength)
            );
            return body.bytesRead();
        }
        return uploadMultipart(bucket, key, mimeType, body);
    }

    /**
     * @throws UploadValidationException if the asset body is empty
     */
    private long uploadMultipart(String bucket, String key, String mimeType, ProgressTrackingInputStream body)
            throws IOException {
        CreateMultipartUploadResponse created = s3Client.createMultipartUpload(CreateMultipartUploadRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(mimeType)
                .build());
        String uploadId = created.uploadId();
        List<CompletedPart> parts = new ArrayList<>();
        byte[] buffer = new byte[MULTIPART_PART_SIZE];
        int partNumber = 1;
        try {
            int filled = readFully(body, buffer);
            if (filled <= 0) {
                throw new UploadValidationException("REMOTE_ASSET_FAILED", "Remote asset body was empty");
            }
            while (filled > 0) {
                byte[] partBytes = filled == buffer.length ? buffer : copyOf(buffer, filled);
                var uploaded = s3Client.uploadPart(
                        UploadPartRequest.builder()
                                .bucket(bucket)
                                .key(key)
                                .uploadId(uploadId)
                                .partNumber(partNumber)
                                .contentLength((long) filled)
                                .build(),
                        RequestBody.fromBytes(partBytes)
                );
                parts.add(CompletedPart.builder().partNumber(partNumber).eTag(uploaded.eTag()).build());
                partNumber++;
                filled = readFully(body, buffer);
            }
            s3Client.completeMultipartUpload(CompleteMultipartUploadRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .uploadId(uploadId)
                    .multipartUpload(CompletedMultipartUpload.builder().parts(parts).build())
                    .build());
            return body.bytesRead();
        } catch (RuntimeException | IOException ex) {
            try {
                s3Client.abortMultipartUpload(AbortMultipartUploadRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .uploadId(uploadId)
                        .build());
            } catch (RuntimeException abortEx) {
                log.warn("Failed to abort multipart upload for key {}", key, abortEx);
            }
            throw ex;
        }
    }

    /**
     * Fills a buffer from an input stream until the buffer is full or the end of the stream is reached.
     *
     * @return the number of bytes read into the buffer
     * @throws IOException if reading from the input stream fails
     */
    private static int readFully(InputStream in, byte[] buffer) throws IOException {
        int offset = 0;
        while (offset < buffer.length) {
            int read = in.read(buffer, offset, buffer.length - offset);
            if (read < 0) {
                return offset;
            }
            offset += read;
        }
        return offset;
    }

    /**
     * Creates a new byte array containing the requested prefix of the source array.
     *
     * @param source the source byte array
     * @param length the number of bytes to copy
     * @return a byte array containing the first {@code length} bytes of the source
     */
    private static byte[] copyOf(byte[] source, int length) {
        byte[] copy = new byte[length];
        System.arraycopy(source, 0, copy, 0, length);
        return copy;
    }

    /**
     * Resolves a safe filename from the supplied hint or the final URI path.
     *
     * @param hint     the preferred filename, if provided
     * @param finalUri the URI from which to derive a filename when no hint is available
     * @return the sanitized filename, or {@code import.bin} when no safe filename can be derived
     */
    private static String resolveFilename(String hint, URI finalUri) {
        if (hint != null && !hint.isBlank()) {
            return MediaUploadRules.sanitizeFilename(hint);
        }
        String path = finalUri == null || finalUri.getPath() == null ? "" : finalUri.getPath();
        int slash = path.lastIndexOf('/');
        String last = slash >= 0 ? path.substring(slash + 1) : path;
        if (last.isBlank() || last.contains("..")) {
            return "import.bin";
        }
        try {
            return MediaUploadRules.sanitizeFilename(last);
        } catch (UploadValidationException ex) {
            return "import.bin";
        }
    }

    private static String resolveMime(AssetType assetType, String contentType, String filename) {
        if (contentType != null && !contentType.isBlank()) {
            String normalized = MediaUploadRules.normalizeMime(contentType);
            if (MediaUploadRules.isAllowedMime(assetType, normalized)) {
                return normalized;
            }
            if (!"application/octet-stream".equals(normalized)) {
                throw new UploadValidationException(
                        "UPLOAD_VALIDATION_FAILED",
                        "mimeType not allowed for assetType " + assetType + ": " + contentType
                );
            }
        }
        String inferred = MediaUploadRules.inferMimeFromFilename(assetType, filename);
        if (inferred == null || !MediaUploadRules.isAllowedMime(assetType, inferred)) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "Could not determine an allowed mimeType for assetType " + assetType
            );
        }
        return inferred;
    }

    private static String buildFinalKey(String tenantSlug, MediaAsset asset) {
        String visibilityFolder = asset.getVisibility() == AssetVisibility.PUBLIC ? "public" : "private";
        String typeFolder = MediaUploadRules.typeFolder(asset.getAssetType());
        String filename = asset.getOriginalFilename() != null ? asset.getOriginalFilename() : "file.bin";
        String ext = MediaUploadRules.fileExtension(filename);
        String stem = MediaUploadRules.sanitizeFilenameStem(filename);
        String objectName = "asset-" + asset.getId() + "_" + stem + "." + ext;
        String relative = typeFolder + "/" + objectName;
        return visibilityFolder.equals("public")
                ? TenantAssetKeys.publicKey(tenantSlug, relative)
                : TenantAssetKeys.privateKey(tenantSlug, relative);
    }

    private void deleteObjectQuietly(String bucket, String key) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (Exception cleanupEx) {
            log.warn("Failed to clean up unreferenced ingest object: {}", key, cleanupEx);
        }
    }

    static final class ProgressTrackingInputStream extends FilterInputStream {

        private final long maxBytes;
        private long bytesRead;
        private long lastReportedBytes;
        private final java.util.function.LongConsumer progressReporter;

        ProgressTrackingInputStream(
                InputStream in,
                long maxBytes,
                java.util.function.LongConsumer progressReporter
        ) {
            super(in);
            this.maxBytes = maxBytes;
            this.progressReporter = progressReporter;
        }

        long bytesRead() {
            return bytesRead;
        }

        @Override
        public int read() throws IOException {
            int value = super.read();
            if (value >= 0) {
                add(1);
            }
            return value;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            int read = super.read(b, off, len);
            if (read > 0) {
                add(read);
            }
            return read;
        }

        private void add(int count) {
            bytesRead += count;
            if (bytesRead > maxBytes) {
                throw new UploadValidationException(
                        "UPLOAD_VALIDATION_FAILED",
                        "Remote asset exceeds max size"
                );
            }
            if (progressReporter != null
                    && bytesRead - lastReportedBytes >= PROGRESS_REPORT_INTERVAL_BYTES) {
                lastReportedBytes = bytesRead;
                progressReporter.accept(bytesRead);
            }
        }
    }
}
