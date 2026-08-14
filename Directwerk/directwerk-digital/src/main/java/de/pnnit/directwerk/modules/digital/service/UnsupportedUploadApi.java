package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.digital.api.UploadApi;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Fallback when object storage is disabled — media upload endpoints fail closed with 503.
 */
@Service
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "false", matchIfMissing = true)
public class UnsupportedUploadApi implements UploadApi {

    @Override
    public UploadUrlResult createUploadUrl(CreateUploadUrlCommand command) {
        throw new StorageNotConfiguredException(
                "Object storage is disabled — set directwerk.storage.enabled=true"
        );
    }

    @Override
    public ConfirmUploadResult confirmUpload(ConfirmUploadCommand command) {
        throw new StorageNotConfiguredException(
                "Object storage is disabled — set directwerk.storage.enabled=true"
        );
    }
}
