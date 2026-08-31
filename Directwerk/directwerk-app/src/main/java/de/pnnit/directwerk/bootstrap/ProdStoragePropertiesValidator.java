package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@Profile("prod")
public class ProdStoragePropertiesValidator {

    private final DirectwerkConfig directwerkConfig;

    public ProdStoragePropertiesValidator(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
    }

    @PostConstruct
    void validateProductionStorage() {
        if (!directwerkConfig.isStorageEnabled()) {
            throw new IllegalStateException("Production DIRECTWERK_STORAGE_ENABLED must be true");
        }
        DirectwerkProperties.Storage storage = directwerkConfig.storage();
        if (storage == null || !StringUtils.hasText(storage.bucket())) {
            throw new IllegalStateException("Production DIRECTWERK_STORAGE_BUCKET must be configured");
        }
        ProdPropertyValidation.requireHttpsUrl(storage.publicCdnBaseUrl(), "DIRECTWERK_STORAGE_PUBLIC_CDN_BASE_URL");
    }
}
