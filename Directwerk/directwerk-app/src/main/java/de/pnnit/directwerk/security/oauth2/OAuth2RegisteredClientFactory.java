package de.pnnit.directwerk.security.oauth2;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.security.grants.PasswordGrantAuthenticationToken;
import java.time.Duration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.stereotype.Component;

@Component
public class OAuth2RegisteredClientFactory {

    public static final String TENANT_INTERNAL_ID = "directwerk-tenant-client";
    public static final String PLATFORM_INTERNAL_ID = "directwerk-platform-client";

    public RegisteredClient buildTenantClient(DirectwerkConfig directwerkConfig, PasswordEncoder passwordEncoder) {
        return buildClient(
                TENANT_INTERNAL_ID,
                directwerkConfig.security().tenantClientId(),
                directwerkConfig.security().tenantClientSecret(),
                "Directwerk Tenant Frontend",
                passwordEncoder
        );
    }

    public RegisteredClient buildPlatformClient(DirectwerkConfig directwerkConfig, PasswordEncoder passwordEncoder) {
        return buildClient(
                PLATFORM_INTERNAL_ID,
                directwerkConfig.security().platformClientId(),
                directwerkConfig.security().platformClientSecret(),
                "Directwerk Platform Admin",
                passwordEncoder
        );
    }

    private static RegisteredClient buildClient(
            String internalId,
            String clientId,
            String clientSecret,
            String clientName,
            PasswordEncoder passwordEncoder
    ) {
        return RegisteredClient.withId(internalId)
                .clientId(clientId)
                .clientSecret(passwordEncoder.encode(clientSecret))
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(PasswordGrantAuthenticationToken.PASSWORD_GRANT_TYPE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .scope("directwerk-api")
                .tokenSettings(TokenSettings.builder()
                        .accessTokenTimeToLive(Duration.ofMinutes(15))
                        .refreshTokenTimeToLive(Duration.ofDays(7))
                        .build())
                .clientSettings(ClientSettings.builder().requireAuthorizationConsent(false).build())
                .clientName(clientName)
                .build();
    }
}
