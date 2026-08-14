package de.pnnit.directwerk.security.grants;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AccessTokenAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContext;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

class PasswordGrantAuthenticationProviderTest {

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);

    @Test
    void unknownUsernameAndWrongPasswordProduceIndistinguishableErrors() {
        UserDetailsService userDetailsService = mock(UserDetailsService.class);
        when(userDetailsService.loadUserByUsername("unknown@example.com"))
                .thenThrow(new UsernameNotFoundException("unknown@example.com"));

        UserDetails realUser = User.withUsername("real@example.com")
                .password(passwordEncoder.encode("correct-horse-battery-staple"))
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_TENANT_ADMIN")))
                .build();
        when(userDetailsService.loadUserByUsername("real@example.com")).thenReturn(realUser);

        PasswordGrantAuthenticationProvider provider = new PasswordGrantAuthenticationProvider(
                userDetailsService,
                passwordEncoder,
                mock(OAuth2AuthorizationService.class),
                mock(OAuth2TokenGenerator.class)
        );

        OAuth2AuthenticationException unknownUserError = catchOAuth2Exception(
                provider, "unknown@example.com", "irrelevant"
        );
        OAuth2AuthenticationException wrongPasswordError = catchOAuth2Exception(
                provider, "real@example.com", "totally-wrong-password"
        );

        assertThat(unknownUserError.getError().getErrorCode()).isEqualTo(OAuth2ErrorCodes.INVALID_GRANT);
        assertThat(wrongPasswordError.getError().getErrorCode()).isEqualTo(OAuth2ErrorCodes.INVALID_GRANT);
        assertThat(unknownUserError.getClass()).isEqualTo(wrongPasswordError.getClass());
    }

    @Test
    void successfulGrantStoresPrincipalAttributeRequiredForRefreshTokenGrant() {
        UserDetailsService userDetailsService = mock(UserDetailsService.class);
        UserDetails user = User.withUsername("real@example.com")
                .password(passwordEncoder.encode("correct-horse-battery-staple"))
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_TENANT_ADMIN")))
                .build();
        when(userDetailsService.loadUserByUsername("real@example.com")).thenReturn(user);

        OAuth2AuthorizationService authorizationService = mock(OAuth2AuthorizationService.class);
        OAuth2TokenGenerator tokenGenerator = mock(OAuth2TokenGenerator.class);
        OAuth2AccessToken generatedToken = new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER,
                "generated-token-value",
                Instant.now(),
                Instant.now().plusSeconds(3600)
        );
        when(tokenGenerator.generate(any())).thenReturn(generatedToken);

        PasswordGrantAuthenticationProvider provider = new PasswordGrantAuthenticationProvider(
                userDetailsService,
                passwordEncoder,
                authorizationService,
                tokenGenerator
        );

        PasswordGrantAuthenticationToken token = new PasswordGrantAuthenticationToken(
                "real@example.com",
                "correct-horse-battery-staple",
                authenticatedClient(),
                Set.of()
        );

        Authentication result;
        AuthorizationServerSettings settings = AuthorizationServerSettings.builder()
                .issuer("https://directwerk.test")
                .build();
        AuthorizationServerContextHolder.setContext(new AuthorizationServerContext() {
            @Override
            public String getIssuer() {
                return settings.getIssuer();
            }

            @Override
            public AuthorizationServerSettings getAuthorizationServerSettings() {
                return settings;
            }
        });
        try {
            result = provider.authenticate(token);
        } finally {
            AuthorizationServerContextHolder.resetContext();
        }
        assertThat(result).isInstanceOf(OAuth2AccessTokenAuthenticationToken.class);

        ArgumentCaptor<OAuth2Authorization> authorizationCaptor = ArgumentCaptor.forClass(OAuth2Authorization.class);
        verify(authorizationService).save(authorizationCaptor.capture());
        OAuth2Authorization savedAuthorization = authorizationCaptor.getValue();

        Authentication storedAuthentication = savedAuthorization.getAttribute(Authentication.class.getName());
        Principal storedPrincipal = savedAuthorization.getAttribute(Principal.class.getName());

        assertThat(storedAuthentication).isNotNull();
        assertThat(storedPrincipal)
                .as("OAuth2RefreshTokenAuthenticationProvider reads the principal via this exact "
                        + "attribute key and asserts it non-null on every refresh_token grant")
                .isNotNull()
                .isSameAs(storedAuthentication);
    }

    private OAuth2AuthenticationException catchOAuth2Exception(
            PasswordGrantAuthenticationProvider provider,
            String username,
            String password
    ) {
        PasswordGrantAuthenticationToken token = new PasswordGrantAuthenticationToken(
                username,
                password,
                authenticatedClient(),
                Set.of()
        );
        return (OAuth2AuthenticationException) assertThatThrownBy(() -> provider.authenticate(token))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .actual();
    }

    private OAuth2ClientAuthenticationToken authenticatedClient() {
        RegisteredClient registeredClient = RegisteredClient.withId("test-client")
                .clientId("test-client")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(PasswordGrantAuthenticationToken.PASSWORD_GRANT_TYPE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .scope("openid")
                .clientIdIssuedAt(Instant.now())
                .build();
        return new OAuth2ClientAuthenticationToken(
                registeredClient,
                ClientAuthenticationMethod.CLIENT_SECRET_BASIC,
                null
        );
    }
}
