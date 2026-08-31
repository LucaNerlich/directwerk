package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import jakarta.annotation.PostConstruct;
import java.util.regex.Pattern;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

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
        ProdPropertyValidation.requireConfigured(email.fromAddress(), "DIRECTWERK_EMAIL_FROM");
        if (!EMAIL_PATTERN.matcher(email.fromAddress()).matches()) {
            throw new IllegalStateException("Production DIRECTWERK_EMAIL_FROM must be configured");
        }
        ProdPropertyValidation.requireHttpsUrl(email.studioBaseUrl(), "DIRECTWERK_EMAIL_STUDIO_BASE_URL");
        ProdPropertyValidation.requireHttpsUrl(email.adminBaseUrl(), "DIRECTWERK_EMAIL_ADMIN_BASE_URL");
    }
}
