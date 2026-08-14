package de.pnnit.directwerk.security.oauth2;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.grants.PasswordGrantAuthenticationToken;
import de.pnnit.directwerk.security.oauth2.OAuth2RegisteredClientFactory;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("flyway-validate")
class OAuth2AuthorizationStoreIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    RegisteredClientRepository registeredClientRepository;

    @Autowired
    OAuth2AuthorizationService authorizationService;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void registerOAuthSecrets(DynamicPropertyRegistry registry) {
        registry.add("directwerk.security.platform-client-secret", () -> "test-platform-" + UUID.randomUUID());
        registry.add("directwerk.security.tenant-client-secret", () -> "test-tenant-" + UUID.randomUUID());
        registry.add("directwerk.security.authorization-store", () -> "jdbc");
    }

    @Test
    void jdbcStorePersistsRegisteredClientsAfterBootstrap() {
        RegisteredClient tenantClient = registeredClientRepository.findByClientId("directwerk-tenant-frontend");
        RegisteredClient platformClient = registeredClientRepository.findByClientId("directwerk-platform-admin");

        assertThat(tenantClient).isNotNull();
        assertThat(tenantClient.getId()).isEqualTo(OAuth2RegisteredClientFactory.TENANT_INTERNAL_ID);
        assertThat(platformClient).isNotNull();
        assertThat(platformClient.getId()).isEqualTo(OAuth2RegisteredClientFactory.PLATFORM_INTERNAL_ID);

        Integer clientCount = jdbcTemplate.queryForObject(
                "select count(*) from oauth2_registered_client",
                new Object[0],
                Integer.class
        );
        assertThat(clientCount).isEqualTo(2);
    }

    @Test
    void jdbcStorePersistsAuthorizationWithTokens() {
        RegisteredClient registeredClient = registeredClientRepository.findByClientId("directwerk-tenant-frontend");
        assertThat(registeredClient).isNotNull();

        Instant issuedAt = Instant.parse("2026-07-18T10:00:00Z");
        Instant accessExpiresAt = issuedAt.plusSeconds(3600);
        Instant refreshExpiresAt = issuedAt.plusSeconds(86400);
        OAuth2AccessToken accessToken = new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER,
                "access-token-value",
                issuedAt,
                accessExpiresAt,
                Set.of("openid", "profile")
        );
        OAuth2RefreshToken refreshToken = new OAuth2RefreshToken("refresh-token-value", issuedAt, refreshExpiresAt);

        OAuth2Authorization authorization = OAuth2Authorization.withRegisteredClient(registeredClient)
                .id(UUID.randomUUID().toString())
                .principalName("user@example.com")
                .authorizationGrantType(PasswordGrantAuthenticationToken.PASSWORD_GRANT_TYPE)
                .authorizedScopes(Set.of("openid", "profile"))
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .build();

        authorizationService.save(authorization);

        OAuth2Authorization loaded = authorizationService.findById(authorization.getId());
        assertThat(loaded).isNotNull();
        assertThat(loaded.getPrincipalName()).isEqualTo("user@example.com");
        assertThat(loaded.getAuthorizedScopes()).containsExactlyInAnyOrder("openid", "profile");
        assertThat(loaded.getAccessToken()).isNotNull();
        assertThat(loaded.getAccessToken().getToken().getTokenValue()).isEqualTo("access-token-value");
        assertThat(loaded.getRefreshToken()).isNotNull();
        assertThat(loaded.getRefreshToken().getToken().getTokenValue()).isEqualTo("refresh-token-value");
    }

    @Test
    void jdbcStoreRoundTripsAuthenticationAttributeWithDirectwerkUserPrincipal() {
        RegisteredClient registeredClient = registeredClientRepository.findByClientId("directwerk-tenant-frontend");
        assertThat(registeredClient).isNotNull();

        Instant issuedAt = Instant.parse("2026-07-18T10:00:00Z");
        OAuth2AccessToken accessToken = new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER,
                "principal-round-trip-access-token",
                issuedAt,
                issuedAt.plusSeconds(3600),
                Set.of("openid", "profile")
        );

        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                42L,
                "user@example.com",
                "hashed-password",
                7L,
                List.of(new SimpleGrantedAuthority("ROLE_EDITOR"))
        );
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
                principal, null, principal.getAuthorities());

        OAuth2Authorization authorization = OAuth2Authorization.withRegisteredClient(registeredClient)
                .id(UUID.randomUUID().toString())
                .principalName(principal.getUsername())
                .authorizationGrantType(PasswordGrantAuthenticationToken.PASSWORD_GRANT_TYPE)
                .authorizedScopes(Set.of("openid", "profile"))
                .accessToken(accessToken)
                .attribute(Authentication.class.getName(), authentication)
                .build();

        authorizationService.save(authorization);

        OAuth2Authorization loaded = authorizationService.findById(authorization.getId());
        assertThat(loaded).isNotNull();
        Authentication loadedAuthentication = loaded.getAttribute(Authentication.class.getName());
        assertThat(loadedAuthentication).isNotNull();
        assertThat(loadedAuthentication.getPrincipal()).isInstanceOf(DirectwerkUserPrincipal.class);
        DirectwerkUserPrincipal loadedPrincipal = (DirectwerkUserPrincipal) loadedAuthentication.getPrincipal();
        assertThat(loadedPrincipal.userId()).isEqualTo(42L);
        assertThat(loadedPrincipal.email()).isEqualTo("user@example.com");
        assertThat(loadedPrincipal.tenantId()).isEqualTo(7L);
        assertThat(loadedPrincipal.getAuthorities()).extracting("authority").containsExactly("ROLE_EDITOR");
        assertThat(loadedPrincipal.passwordHash()).isNull();

        String storedAttributes = jdbcTemplate.queryForObject(
                "select attributes from oauth2_authorization where id = ?",
                String.class,
                authorization.getId()
        );
        assertThat(storedAttributes).doesNotContain("hashed-password");
    }

    @Test
    void jdbcStoreRoundTripsAccessTokenClaimsWithLongTenantIdAndImmutableAud() {
        RegisteredClient registeredClient = registeredClientRepository.findByClientId("directwerk-tenant-frontend");
        assertThat(registeredClient).isNotNull();

        Instant issuedAt = Instant.parse("2026-07-18T10:00:00Z");
        OAuth2AccessToken accessToken = new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER,
                "claims-long-tenant-access-token",
                issuedAt,
                issuedAt.plusSeconds(3600),
                Set.of("openid", "profile")
        );

        Map<String, Object> claims = new HashMap<>();
        claims.put("sub", "user@example.com");
        claims.put("tenant_id", 10L);
        // Mimic JwtEncoder / List.of audience + roles (ImmutableCollections$ListN / SetN).
        claims.put("aud", List.of("directwerk-tenant-frontend"));
        claims.put("roles", Set.of("EDITOR"));

        OAuth2Authorization authorization = OAuth2Authorization.withRegisteredClient(registeredClient)
                .id(UUID.randomUUID().toString())
                .principalName("user@example.com")
                .authorizationGrantType(PasswordGrantAuthenticationToken.PASSWORD_GRANT_TYPE)
                .authorizedScopes(Set.of("openid", "profile"))
                .token(accessToken, metadata -> metadata.put(
                        OAuth2Authorization.Token.CLAIMS_METADATA_NAME,
                        claims
                ))
                .build();

        authorizationService.save(authorization);

        OAuth2Authorization loaded = authorizationService.findById(authorization.getId());
        assertThat(loaded).isNotNull();
        assertThat(loaded.getAccessToken()).isNotNull();
        Map<String, Object> loadedClaims = loaded.getAccessToken().getClaims();
        assertThat(loadedClaims).isNotNull();
        assertThat(loadedClaims.get("tenant_id")).isEqualTo(10L);
        assertThat(loadedClaims.get("aud")).asList().containsExactly("directwerk-tenant-frontend");
        assertThat(loadedClaims.get("roles")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.ITERABLE)
                .containsExactly("EDITOR");
    }
}
