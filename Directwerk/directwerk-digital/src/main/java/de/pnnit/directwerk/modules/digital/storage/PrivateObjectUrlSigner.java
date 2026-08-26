package de.pnnit.directwerk.modules.digital.storage;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import java.net.URL;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

/**
 * Single seam for "hand out a time-limited URL to a private object".
 *
 * <p>Delivery policy lives here once: Bunny Advanced Token Auth on the private pull zone when
 * both {@code private-cdn-base-url} and {@code cdn-token-auth-key} are configured; a clear
 * configuration error when only one of them is set; an S3 pre-signed GET otherwise. The TTL is
 * a parameter so API downloads and RSS delivery can keep their different lifetimes without
 * duplicating the decision tree.</p>
 */
@Component
@RequiredArgsConstructor
public class PrivateObjectUrlSigner {

    private final DirectwerkConfig directwerkConfig;
    private final ObjectProvider<S3Presigner> s3Presigner;

    public URL signPrivateObject(String s3Key, Duration ttl) {
        DirectwerkProperties.Storage storage = directwerkConfig.storage();
        boolean hasPrivateCdn = storage != null && StringUtils.hasText(storage.privateCdnBaseUrl());
        boolean hasTokenKey = storage != null && StringUtils.hasText(storage.cdnTokenAuthKey());
        if (hasPrivateCdn && hasTokenKey) {
            return BunnyTokenUrlSigner.signObjectGet(
                    storage.privateCdnBaseUrl(),
                    s3Key,
                    storage.cdnTokenAuthKey(),
                    ttl
            );
        }
        if (hasPrivateCdn || hasTokenKey) {
            throw new StorageNotConfiguredException(
                    "Private CDN token auth requires both private-cdn-base-url and cdn-token-auth-key"
            );
        }
        return presignGet(s3Key, ttl);
    }

    private URL presignGet(String s3Key, Duration ttl) {
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
                .key(s3Key)
                .build();
        PresignedGetObjectRequest presigned = presigner.presignGetObject(GetObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .getObjectRequest(getObjectRequest)
                .build());
        return presigned.url();
    }
}
