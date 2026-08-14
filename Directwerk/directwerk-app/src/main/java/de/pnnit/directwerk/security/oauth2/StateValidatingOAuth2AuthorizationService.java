package de.pnnit.directwerk.security.oauth2;

import de.pnnit.directwerk.multitenancy.TenantNotFoundException;
import de.pnnit.directwerk.multitenancy.TenantSuspendedException;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import java.security.Principal;
import java.util.Objects;
import org.springframework.lang.Nullable;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;

/**
 * Reloads current user/tenant/membership state on refresh-token lookups instead of trusting the
 * saved authorization snapshot. Invalid or changed authorizations are revoked before token issue.
 */
public final class StateValidatingOAuth2AuthorizationService implements OAuth2AuthorizationService {

    private final OAuth2AuthorizationService delegate;
    private final UserDetailsService userDetailsService;

    public StateValidatingOAuth2AuthorizationService(
            OAuth2AuthorizationService delegate,
            UserDetailsService userDetailsService
    ) {
        this.delegate = delegate;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public void save(OAuth2Authorization authorization) {
        delegate.save(authorization);
    }

    @Override
    public void remove(OAuth2Authorization authorization) {
        delegate.remove(authorization);
    }

    @Override
    @Nullable
    public OAuth2Authorization findById(String id) {
        return delegate.findById(id);
    }

    @Override
    @Nullable
    public OAuth2Authorization findByToken(String token, @Nullable OAuth2TokenType tokenType) {
        OAuth2Authorization authorization = delegate.findByToken(token, tokenType);
        if (authorization == null || !isRefreshTokenLookup(tokenType, authorization, token)) {
            return authorization;
        }

        try {
            UserDetails freshUser = userDetailsService.loadUserByUsername(authorization.getPrincipalName());
            Authentication storedAuthentication = authorization.getAttribute(Authentication.class.getName());
            if (storedAuthentication == null
                    || !(storedAuthentication.getPrincipal() instanceof DirectwerkUserPrincipal previous)
                    || !(freshUser instanceof DirectwerkUserPrincipal current)
                    || !Objects.equals(previous.userId(), current.userId())
                    || !Objects.equals(previous.tenantId(), current.tenantId())) {
                delegate.remove(authorization);
                return null;
            }

            Authentication refreshedAuthentication = UsernamePasswordAuthenticationToken.authenticated(
                    freshUser,
                    null,
                    freshUser.getAuthorities()
            );
            OAuth2Authorization updated = OAuth2Authorization.from(authorization)
                    .principalName(freshUser.getUsername())
                    .attribute(Authentication.class.getName(), refreshedAuthentication)
                    .attribute(Principal.class.getName(), refreshedAuthentication)
                    .build();
            delegate.save(updated);
            return updated;
        } catch (UsernameNotFoundException | TenantSuspendedException | TenantNotFoundException ex) {
            delegate.remove(authorization);
            return null;
        }
    }

    private static boolean isRefreshTokenLookup(
            @Nullable OAuth2TokenType tokenType,
            OAuth2Authorization authorization,
            String token
    ) {
        if (OAuth2TokenType.REFRESH_TOKEN.equals(tokenType)) {
            return true;
        }
        if (tokenType != null) {
            return false;
        }
        OAuth2Authorization.Token<org.springframework.security.oauth2.core.OAuth2RefreshToken> refreshToken =
                authorization.getRefreshToken();
        return refreshToken != null && token.equals(refreshToken.getToken().getTokenValue());
    }
}
