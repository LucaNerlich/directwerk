package de.pnnit.directwerk.bootstrap;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
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
    private final String forwardHeadersStrategy;

    public ProdSecurityPropertiesValidator(
            DirectwerkConfig directwerkConfig,
            @Value("${server.forward-headers-strategy:none}") String forwardHeadersStrategy) {
        this.directwerkConfig = directwerkConfig;
        this.forwardHeadersStrategy = forwardHeadersStrategy;
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
        // Only required when a reverse proxy is actually in front of the app (the
        // documented Coolify/Traefik topology) — the other valid prod topology
        // (forward-headers-strategy=none) has no reverse proxy, so an empty list there
        // is correct by design, not a misconfiguration.
        if ("framework".equalsIgnoreCase(forwardHeadersStrategy) && security.trustedProxies().isEmpty()) {
            throw new IllegalStateException(
                    "Production DIRECTWERK_SECURITY_TRUSTED_PROXIES must be configured when "
                            + "server.forward-headers-strategy=framework, otherwise auth/billing rate "
                            + "limiting collapses every client behind the reverse proxy into one shared bucket");
        }
    }
}
