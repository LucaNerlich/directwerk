package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import jakarta.annotation.PostConstruct;
import java.net.URI;
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
        requireHttpsUrl(storage.publicCdnBaseUrl(), "DIRECTWERK_STORAGE_PUBLIC_CDN_BASE_URL");
    }

    private static void requireHttpsUrl(String value, String propertyName) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException("Production " + propertyName + " must be configured");
        }
        URI uri;
        try {
            uri = URI.create(value.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Production " + propertyName + " must be an absolute HTTPS URL", ex);
        }
        if (!uri.isAbsolute() || !"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalStateException("Production " + propertyName + " must be an absolute HTTPS URL");
        }
        if (!StringUtils.hasText(uri.getHost())) {
            throw new IllegalStateException("Production " + propertyName + " must include a host");
        }
    }
}
