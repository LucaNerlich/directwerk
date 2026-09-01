package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("prod")
public class ProdSecurityPropertiesValidator {

    private final DirectwerkConfig directwerkConfig;

    public ProdSecurityPropertiesValidator(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
    }

    @PostConstruct
    void validateProductionSecurity() {
        DirectwerkProperties.Security security = directwerkConfig.security();
        ProdPropertyValidation.requireConfigured(security.issuer(), "DIRECTWERK_ISSUER");
        if (!security.issuer().startsWith("https://")) {
            throw new IllegalStateException("Production DIRECTWERK_ISSUER must use https://");
        }
        if (directwerkConfig.isExposeDevTokens()) {
            throw new IllegalStateException("Production DIRECTWERK_ACCOUNT_EXPOSE_DEV_TOKENS must be false");
        }
        ProdPropertyValidation.requireConfigured(security.platformClientSecret(), "DIRECTWERK_PLATFORM_CLIENT_SECRET");
        ProdPropertyValidation.requireConfigured(security.tenantClientSecret(), "DIRECTWERK_TENANT_CLIENT_SECRET");
        ProdPropertyValidation.requireConfigured(security.jwtPrivateKey(), "DIRECTWERK_JWT_PRIVATE_KEY");
        ProdPropertyValidation.requireConfigured(security.jwtPublicKey(), "DIRECTWERK_JWT_PUBLIC_KEY");
    }
}
