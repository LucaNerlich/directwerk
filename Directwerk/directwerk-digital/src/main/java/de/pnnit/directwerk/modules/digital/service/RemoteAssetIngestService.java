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
import de.pnnit.directwerk.modules.digital.net.RemoteContentClient;
import de.pnnit.directwerk.modules.digital.net.RemoteUrlValidator;
import de.pnnit.directwerk.modules.digital.repository.MediaAssetRepository;
import de.pnnit.directwerk.modules.digital.storage.StorageConfigs;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
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
    private static final Duration INGEST_TIMEOUT = Duration.ofMinutes(15);

    private final S3Client s3Client;
    private final RemoteContentClient remoteContentClient;
    private final MediaAssetRepository mediaAssetRepository;
    private final TenantRepository tenantRepository;
    private final DirectwerkConfig directwerkConfig;

    /**
     * Imports a remote HTTP(S) asset into the active tenant's storage.
     *
     * @param command the source URL and asset metadata for the import
     * @return the persisted media asset after successful upload
     */
    @Override
    public MediaAsset ingestFromUrl(IngestCommand command) {
        DirectwerkProperties.Storage storage = StorageConfigs.requireEnabled(directwerkConfig);
        Long tenantId = TenantContext.requireTenantId();
        Tenant tenant = tenantRepository.requireById(tenantId);
        URI source = RemoteUrlValidator.requirePublicHttpUrl(command.sourceUrl());
        AssetType assetType = command.assetType();
        if (assetType == null) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "assetType is required");
        }
        AssetVisibility visibility = command.intendedVisibility() == null
                ? AssetVisibility.PRIVATE
                : command.intendedVisibility();
        AssetScope scope = visibility == AssetVisibility.PUBLIC ? AssetScope.TENANT_PUBLIC : AssetScope.CONTENT;

        try (RemoteContentClient.RemoteResponse remote = remoteContentClient.get(source, INGEST_TIMEOUT)) {
            if (remote.statusCode() < 200 || remote.statusCode() >= 300) {
                throw new UploadValidationException(
                        "REMOTE_ASSET_FAILED",
                        "Remote asset returned HTTP " + remote.statusCode()
                );
            }
            String filename = resolveFilename(command.filenameHint(), remote.finalUri());
            String mimeType = resolveMime(assetType, remote.contentType(), filename);
            long maxBytes = MediaUploadRules.maxBytes(assetType);
            if (remote.contentLength() != null && remote.contentLength() > maxBytes) {
                throw new UploadValidationException(
                        "UPLOAD_VALIDATION_FAILED",
                        "Remote asset exceeds max size for " + assetType
                );
            }

            MediaAsset asset = new MediaAsset();
            asset.setTenant(tenant);
            asset.setS3Key(TenantAssetKeys.stagingKey(tenant.getSlug(), UUID.randomUUID() + "/" + filename));
            asset.setVisibility(visibility);
            asset.setScope(scope);
            asset.setAssetType(assetType);
            asset.setStatus(AssetStatus.PENDING);
            asset.setMimeType(mimeType);
            asset.setSizeBytes(remote.contentLength());
            asset.setOriginalFilename(filename);
            mediaAssetRepository.saveAndFlush(asset);

            String finalKey = buildFinalKey(tenant.getSlug(), asset);
            try {
                // Persist the exact upload target while the row is still PENDING.
                // A process crash can then leave a recoverable pending record, not
                // an S3 object whose key is unknown to the database.
                asset.setS3Key(finalKey);
                mediaAssetRepository.saveAndFlush(asset);
                LimitedInputStream limited = new LimitedInputStream(remote.body(), maxBytes);
                long written = streamToS3(
                        storage.bucket(),
                        finalKey,
                        mimeType,
                        remote.contentLength(),
                        limited
                );
                asset.setSizeBytes(written);
                asset.setStatus(AssetStatus.READY);
                return mediaAssetRepository.saveAndFlush(asset);
            } catch (RuntimeException | IOException ex) {
                deleteObjectQuietly(storage.bucket(), finalKey);
                mediaAssetRepository.delete(asset);
                throw ex;
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

    /**
     * Streams an asset to S3 using a single request when its declared length is available,
     * or multipart upload otherwise.
     *
     * @param bucket         the destination S3 bucket
     * @param key            the destination object key
     * @param mimeType       the asset's MIME type
     * @param declaredLength the asset's declared length, when available
     * @param body           the limited input stream containing the asset
     * @return the number of bytes read from the asset
     * @throws IOException if reading the asset fails
     */
    private long streamToS3(
            String bucket,
            String key,
            String mimeType,
            Long declaredLength,
            LimitedInputStream body
    ) throws IOException {
        if (declaredLength != null && declaredLength > 0) {
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
     * Uploads the remote asset using S3 multipart upload.
     *
     * @param bucket the destination S3 bucket
     * @param key the destination object key
     * @param mimeType the object's MIME type
     * @param body the asset stream
     * @return the number of bytes uploaded
     * @throws IOException if reading the asset fails
     * @throws UploadValidationException if the asset body is empty
     */
    private long uploadMultipart(String bucket, String key, String mimeType, LimitedInputStream body)
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

    /**
     * Resolves an allowed MIME type for an asset from the remote content type or filename.
     *
     * @param assetType   the asset category used to validate the MIME type
     * @param contentType the remote content type, when available
     * @param filename    the filename used for MIME type inference
     * @return            the normalized or inferred allowed MIME type
     */
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

    /**
     * Builds the tenant-scoped S3 key for a media asset.
     *
     * @param tenantSlug the tenant identifier used in the key
     * @param asset      the asset whose visibility, type, identifier, and filename determine the key
     * @return the S3 key for the asset
     */
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

    /**
     * Attempts to delete an S3 object while suppressing cleanup failures.
     *
     * @param bucket the S3 bucket containing the object
     * @param key    the object's S3 key
     */
    private void deleteObjectQuietly(String bucket, String key) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (Exception cleanupEx) {
            log.warn("Failed to clean up unreferenced ingest object: {}", key, cleanupEx);
        }
    }

    static final class LimitedInputStream extends FilterInputStream {

        private final long maxBytes;
        private long bytesRead;

        /**
         * Creates a stream that limits the total number of bytes read from the wrapped stream.
         *
         * @param in       the stream to wrap
         * @param maxBytes the maximum number of bytes permitted
         */
        LimitedInputStream(InputStream in, long maxBytes) {
            super(in);
            this.maxBytes = maxBytes;
        }

        /**
         * Reports the number of bytes read from the wrapped input stream.
         *
         * @return the accumulated number of bytes read
         */
        long bytesRead() {
            return bytesRead;
        }

        /**
         * Reads one byte and updates the accumulated byte count.
         *
         * @return the byte read, or {@code -1} if the end of the stream has been reached
         * @throws IOException if an I/O error occurs
         */
        @Override
        public int read() throws IOException {
            int value = super.read();
            if (value >= 0) {
                add(1);
            }
            return value;
        }

        /**
         * Reads bytes from the wrapped stream and updates the accumulated byte count.
         *
         * @return the number of bytes read, or {@code -1} at end of stream
         */
        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            int read = super.read(b, off, len);
            if (read > 0) {
                add(read);
            }
            return read;
        }

        /**
         * Records bytes read and rejects the stream when the configured size limit is exceeded.
         *
         * @param count the number of newly read bytes
         */
        private void add(int count) {
            bytesRead += count;
            if (bytesRead > maxBytes) {
                throw new UploadValidationException(
                        "UPLOAD_VALIDATION_FAILED",
                        "Remote asset exceeds max size"
                );
            }
        }
    }
}
