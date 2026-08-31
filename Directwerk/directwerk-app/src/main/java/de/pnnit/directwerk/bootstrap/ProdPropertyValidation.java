package de.pnnit.directwerk.bootstrap;

import java.net.URI;
import org.springframework.util.StringUtils;

/** Shared fail-fast checks for the {@code Prod*PropertiesValidator} startup validators. */
final class ProdPropertyValidation {

    private ProdPropertyValidation() {
    }

    static void requireConfigured(String value, String propertyName) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException("Production " + propertyName + " must be configured");
        }
    }

    static void requireHttpsUrl(String value, String propertyName) {
        requireConfigured(value, propertyName);
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
