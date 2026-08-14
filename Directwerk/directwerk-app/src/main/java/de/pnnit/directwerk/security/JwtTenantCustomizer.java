package de.pnnit.directwerk.security;

import de.pnnit.directwerk.config.DirectwerkConfig;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.stereotype.Component;

@Component
public class JwtTenantCustomizer implements OAuth2TokenCustomizer<JwtEncodingContext> {

    private final DirectwerkConfig directwerkConfig;

    public JwtTenantCustomizer(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
    }

    @Override
    public void customize(JwtEncodingContext context) {
        if (!org.springframework.security.oauth2.server.authorization.OAuth2TokenType.ACCESS_TOKEN
                .equals(context.getTokenType())) {
            return;
        }

        Object principal = context.getPrincipal().getPrincipal();
        if (!(principal instanceof DirectwerkUserPrincipal directwerkUserPrincipal)) {
            return;
        }

        context.getClaims().claim("email", directwerkUserPrincipal.email());
        context.getClaims().subject(String.valueOf(directwerkUserPrincipal.userId()));
        context.getClaims().claim("roles", directwerkUserPrincipal.roleNames());
        context.getClaims().audience(java.util.List.of(directwerkConfig.security().audience()));
        if (directwerkUserPrincipal.tenantId() != null) {
            context.getClaims().claim("tenant_id", directwerkUserPrincipal.tenantId());
        }
    }
}
