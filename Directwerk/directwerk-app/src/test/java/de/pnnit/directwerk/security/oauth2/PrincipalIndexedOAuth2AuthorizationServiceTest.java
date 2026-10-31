package de.pnnit.directwerk.security.oauth2;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.server.authorization.InMemoryOAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;

/**
 * Issue #971: memory store must revoke by principal on password change —
 * the index is what makes that possible without a JDBC DELETE.
 */
class PrincipalIndexedOAuth2AuthorizationServiceTest {

    @Test
    void removeByPrincipalNameDropsMatchingAuthorizations() {
        PrincipalIndexedOAuth2AuthorizationService service =
                new PrincipalIndexedOAuth2AuthorizationService(new InMemoryOAuth2AuthorizationService());
        OAuth2Authorization keep = authorization("other@example.com", "refresh-keep");
        OAuth2Authorization revokeA = authorization("user@example.com", "refresh-a");
        OAuth2Authorization revokeB = authorization("user@example.com", "refresh-b");
        service.save(keep);
        service.save(revokeA);
        service.save(revokeB);

        int removed = service.removeByPrincipalName("user@example.com");

        assertThat(removed).isEqualTo(2);
        assertThat(service.findByToken("refresh-a", OAuth2TokenType.REFRESH_TOKEN)).isNull();
        assertThat(service.findByToken("refresh-b", OAuth2TokenType.REFRESH_TOKEN)).isNull();
        assertThat(service.findByToken("refresh-keep", OAuth2TokenType.REFRESH_TOKEN)).isEqualTo(keep);
    }

    @Test
    void removeByPrincipalNameIsIdempotentWhenNothingStored() {
        PrincipalIndexedOAuth2AuthorizationService service =
                new PrincipalIndexedOAuth2AuthorizationService(new InMemoryOAuth2AuthorizationService());

        assertThat(service.removeByPrincipalName("nobody@example.com")).isZero();
    }

    private static OAuth2Authorization authorization(String principal, String refreshValue) {
        RegisteredClient client = RegisteredClient.withId("client-id")
                .clientId("directwerk-tenant-frontend")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .build();
        Instant now = Instant.now();
        OAuth2AccessToken access = new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER,
                "access-" + refreshValue,
                now,
                now.plusSeconds(300)
        );
        OAuth2RefreshToken refresh = new OAuth2RefreshToken(refreshValue, now, now.plusSeconds(3600));
        return OAuth2Authorization.withRegisteredClient(client)
                .id(refreshValue)
                .principalName(principal)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .token(access)
                .token(refresh)
                .build();
    }
}
