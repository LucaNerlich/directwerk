package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
// Stage is internet-reachable (see application-stage.yaml) and must get the same
// fail-fast guarantees as prod — a leaked or misconfigured DIRECTWERK_ACCOUNT_EXPOSE_DEV_TOKENS
// on stage previously had no startup check at all.
@Profile({"prod", "stage"})
public class ProdSecurityPropertiesValidator {

    /** Approximate entropy floor for the two secrets used as symmetric key material (see EnvelopeCipher). */
    private static final int MIN_SECRET_LENGTH = 32;

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
        ProdPropertyValidation.requireMinLength(
                security.platformClientSecret(), "DIRECTWERK_PLATFORM_CLIENT_SECRET", MIN_SECRET_LENGTH);
        ProdPropertyValidation.requireMinLength(
                security.tenantClientSecret(), "DIRECTWERK_TENANT_CLIENT_SECRET", MIN_SECRET_LENGTH);
        ProdPropertyValidation.requireConfigured(security.jwtPrivateKey(), "DIRECTWERK_JWT_PRIVATE_KEY");
        ProdPropertyValidation.requireConfigured(security.jwtPublicKey(), "DIRECTWERK_JWT_PUBLIC_KEY");
        // trusted-proxies stay optional: Coolify/Traefik IPs are unstable across redeploys.
        // Rate limiting falls back to RemoteAddr when the list is empty (see ClientIpExtractor).
    }
}
