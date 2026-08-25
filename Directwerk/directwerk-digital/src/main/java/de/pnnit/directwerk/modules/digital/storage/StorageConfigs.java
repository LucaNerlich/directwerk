package de.pnnit.directwerk.modules.digital.storage;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.digital.exception.StorageNotConfiguredException;

public final class StorageConfigs {

    private StorageConfigs() {
    }

    public static DirectwerkProperties.Storage requireEnabled(DirectwerkConfig config) {
        if (!config.isStorageEnabled()) {
            throw new StorageNotConfiguredException("Object storage is disabled");
        }
        DirectwerkProperties.Storage storage = config.storage();
        if (storage == null || storage.bucket() == null || storage.bucket().isBlank()) {
            throw new StorageNotConfiguredException("Object storage bucket is not configured");
        }
        return storage;
    }
}
