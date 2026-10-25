package de.pnnit.directwerk.modules.digital.storage;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsResponse;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.S3Error;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * Deletes many objects via S3 {@code DeleteObjects} (Bunny/Hetzner bulk delete).
 * <p>
 * Bunny Storage supports at most {@value #MAX_KEYS_PER_REQUEST} keys per request; this helper
 * chunks larger inputs. Missing keys are treated as success (idempotent).
 *
 * @see <a href="https://bunny.net/docs/storage/s3#bulk-delete">Bunny S3 bulk delete</a>
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
public class S3BulkObjectDeleter {

    /** Bunny/S3 {@code DeleteObjects} hard limit. */
    public static final int MAX_KEYS_PER_REQUEST = 1000;

    private static final Logger log = LoggerFactory.getLogger(S3BulkObjectDeleter.class);

    private final S3Client s3Client;

    /**
     * Deletes the given keys in batches of at most {@link #MAX_KEYS_PER_REQUEST}.
     * <p>
     * Blank keys are skipped; empty input is a no-op. Duplicate keys are collapsed before
     * the first request. Failures other than not-found abort the call.
     *
     * @param bucket target bucket
     * @param keys   object keys to delete (order preserved after dedupe)
     */
    public void deleteQuietly(String bucket, Collection<String> keys) {
        if (!StringUtils.hasText(bucket)) {
            throw new IllegalArgumentException("bucket is required");
        }
        List<String> uniqueKeys = normalizeKeys(keys);
        if (uniqueKeys.isEmpty()) {
            return;
        }
        for (int from = 0; from < uniqueKeys.size(); from += MAX_KEYS_PER_REQUEST) {
            int to = Math.min(from + MAX_KEYS_PER_REQUEST, uniqueKeys.size());
            deleteChunk(bucket, uniqueKeys.subList(from, to));
        }
    }

    private void deleteChunk(String bucket, List<String> keys) {
        List<ObjectIdentifier> objects = new ArrayList<>(keys.size());
        for (String key : keys) {
            objects.add(ObjectIdentifier.builder().key(key).build());
        }
        DeleteObjectsResponse response;
        try {
            response = s3Client.deleteObjects(DeleteObjectsRequest.builder()
                    .bucket(bucket)
                    .delete(Delete.builder()
                            .quiet(true)
                            .objects(objects)
                            .build())
                    .build());
        } catch (S3Exception ex) {
            if (isNotFound(ex.statusCode(), ex.awsErrorDetails() != null
                    ? ex.awsErrorDetails().errorCode()
                    : null)) {
                log.debug("Bulk delete treated as complete after not-found response (bucket={})", bucket);
                return;
            }
            throw ex;
        }
        failOnUnexpectedErrors(bucket, response.errors());
    }

    private static void failOnUnexpectedErrors(String bucket, List<S3Error> errors) {
        if (errors == null || errors.isEmpty()) {
            return;
        }
        for (S3Error error : errors) {
            if (isNotFound(null, error.code())) {
                log.debug("Bulk delete key already absent (idempotent): bucket={} key={}",
                        bucket, error.key());
                continue;
            }
            throw S3Exception.builder()
                    .statusCode(errorCodeToStatus(error.code()))
                    .message("Bulk delete failed for key '" + error.key() + "': "
                            + error.code() + " — " + error.message())
                    .build();
        }
    }

    private static List<String> normalizeKeys(Collection<String> keys) {
        if (keys == null || keys.isEmpty()) {
            return List.of();
        }
        Set<String> unique = new LinkedHashSet<>();
        for (String key : keys) {
            if (StringUtils.hasText(key)) {
                unique.add(key);
            }
        }
        return List.copyOf(unique);
    }

    private static boolean isNotFound(Integer statusCode, String errorCode) {
        if (statusCode != null && statusCode == 404) {
            return true;
        }
        if (errorCode == null || errorCode.isBlank()) {
            return false;
        }
        String normalized = errorCode.trim().toLowerCase(Locale.ROOT);
        return "nosuchkey".equals(normalized)
                || "notfound".equals(normalized)
                || "404".equals(normalized);
    }

    private static int errorCodeToStatus(String errorCode) {
        if (errorCode != null && errorCode.toLowerCase(Locale.ROOT).contains("access")) {
            return 403;
        }
        return 500;
    }
}
