package de.pnnit.directwerk.security.oauth2;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.multitenancy.TenantSuspendedException;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.time.Instant;
import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;

@ExtendWith(MockitoExtension.class)
class StateValidatingOAuth2AuthorizationServiceTest {

    @Mock
    private OAuth2AuthorizationService delegate;

    @Mock
    private UserDetailsService userDetailsService;

    @Test
    void refreshLookupRevokesAuthorizationWhenUserOrTenantNoLongerValid() {
        StateValidatingOAuth2AuthorizationService service =
                new StateValidatingOAuth2AuthorizationService(delegate, userDetailsService);
        OAuth2Authorization authorization = authorization("user@example.com", principal(11L, 22L));
        when(delegate.findByToken("refresh-token", OAuth2TokenType.REFRESH_TOKEN)).thenReturn(authorization);
        when(userDetailsService.loadUserByUsername("user@example.com"))
                .thenThrow(new TenantSuspendedException("acme"));

        OAuth2Authorization result = service.findByToken("refresh-token", OAuth2TokenType.REFRESH_TOKEN);

        assertThat(result).isNull();
        verify(delegate).remove(authorization);
        verify(delegate, never()).save(any());
    }

    @Test
    void refreshLookupRevokesAuthorizationWhenTenantChanges() {
        StateValidatingOAuth2AuthorizationService service =
                new StateValidatingOAuth2AuthorizationService(delegate, userDetailsService);
        DirectwerkUserPrincipal previous = principal(11L, 22L);
        OAuth2Authorization authorization = authorization("user@example.com", previous);
        DirectwerkUserPrincipal fresh = principal(11L, 99L);
        when(delegate.findByToken("refresh-token", OAuth2TokenType.REFRESH_TOKEN)).thenReturn(authorization);
        when(userDetailsService.loadUserByUsername("user@example.com")).thenReturn(fresh);

        OAuth2Authorization result = service.findByToken("refresh-token", OAuth2TokenType.REFRESH_TOKEN);

        assertThat(result).isNull();
        verify(delegate).remove(authorization);
        verify(delegate, never()).save(any());
    }

    @Test
    void refreshLookupRevokesAuthorizationWhenUserIdChanges() {
        StateValidatingOAuth2AuthorizationService service =
                new StateValidatingOAuth2AuthorizationService(delegate, userDetailsService);
        DirectwerkUserPrincipal previous = principal(11L, 22L);
        OAuth2Authorization authorization = authorization("user@example.com", previous);
        DirectwerkUserPrincipal fresh = principal(99L, 22L);
        when(delegate.findByToken("refresh-token", OAuth2TokenType.REFRESH_TOKEN)).thenReturn(authorization);
        when(userDetailsService.loadUserByUsername("user@example.com")).thenReturn(fresh);

        OAuth2Authorization result = service.findByToken("refresh-token", OAuth2TokenType.REFRESH_TOKEN);

        assertThat(result).isNull();
        verify(delegate).remove(authorization);
        verify(delegate, never()).save(any());
    }

    @Test
    void refreshLookupReloadsPrincipalWhenStillValid() {
        StateValidatingOAuth2AuthorizationService service =
                new StateValidatingOAuth2AuthorizationService(delegate, userDetailsService);
        DirectwerkUserPrincipal previous = principal(11L, 22L);
        OAuth2Authorization authorization = authorization("user@example.com", previous);
        DirectwerkUserPrincipal fresh = principal(11L, 22L);
        when(delegate.findByToken("refresh-token", OAuth2TokenType.REFRESH_TOKEN)).thenReturn(authorization);
        when(userDetailsService.loadUserByUsername("user@example.com")).thenReturn(fresh);

        OAuth2Authorization result = service.findByToken("refresh-token", OAuth2TokenType.REFRESH_TOKEN);

        ArgumentCaptor<OAuth2Authorization> captor = ArgumentCaptor.forClass(OAuth2Authorization.class);
        verify(delegate).save(captor.capture());
        Authentication refreshed = captor.getValue().getAttribute(Authentication.class.getName());
        assertThat(result).isSameAs(captor.getValue());
        assertThat(refreshed.getPrincipal()).isSameAs(fresh);
    }

    private static DirectwerkUserPrincipal principal(Long userId, Long tenantId) {
        return new DirectwerkUserPrincipal(
                userId,
                "user@example.com",
                "hash",
                tenantId,
                List.of(new SimpleGrantedAuthority("ROLE_EDITOR"))
        );
    }

    private static OAuth2Authorization authorization(String principalName, DirectwerkUserPrincipal principal) {
        RegisteredClient client = RegisteredClient.withId("client-id")
                .clientId("directwerk-tenant-frontend")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .build();
        Instant now = Instant.parse("2026-07-18T12:00:00Z");
        OAuth2AccessToken accessToken = new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER,
                "access-token",
                now,
                now.plusSeconds(60)
        );
        OAuth2RefreshToken refreshToken = new OAuth2RefreshToken("refresh-token", now, now.plusSeconds(3600));
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
                principal,
                null,
                principal.getAuthorities()
        );
        return OAuth2Authorization.withRegisteredClient(client)
                .principalName(principalName)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .attribute(Authentication.class.getName(), authentication)
                .token(accessToken)
                .token(refreshToken)
                .build();
    }
}
