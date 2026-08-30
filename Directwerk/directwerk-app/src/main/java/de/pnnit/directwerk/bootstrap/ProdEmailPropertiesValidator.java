package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.util.regex.Pattern;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@Profile("prod")
public class ProdEmailPropertiesValidator {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[a-zA-Z0-9_+&*-]+(?:\\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}$"
    );

    private final DirectwerkConfig directwerkConfig;

    public ProdEmailPropertiesValidator(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
    }

    @PostConstruct
    void validateProductionEmail() {
        if (!directwerkConfig.isEmailEnabled()) {
            return;
        }

        DirectwerkProperties.Email email = directwerkConfig.email();
        requireConfigured(email.fromAddress(), "DIRECTWERK_EMAIL_FROM", true);
        requireConfigured(email.studioBaseUrl(), "DIRECTWERK_EMAIL_STUDIO_BASE_URL", false);
        requireConfigured(email.adminBaseUrl(), "DIRECTWERK_EMAIL_ADMIN_BASE_URL", false);
    }

    private void requireConfigured(String value, String propertyName, boolean emailFormat) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException("Production " + propertyName + " must be configured");
        }
        if (emailFormat && !EMAIL_PATTERN.matcher(value).matches()) {
            throw new IllegalStateException("Production " + propertyName + " must be configured");
        }
        if (!emailFormat) {
            requireHttpsUrl(value, propertyName);
        }
    }

    private static void requireHttpsUrl(String value, String propertyName) {
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
