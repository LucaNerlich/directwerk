package de.pnnit.directwerk.security;

import java.util.Collection;
import java.util.Set;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

/**
 * Opaque tenant API key authentication. Principal is a {@link DirectwerkUserPrincipal}
 * bound to the key's tenant and minting user; scopes drive content path access.
 */
public final class TenantApiKeyAuthenticationToken extends AbstractAuthenticationToken {

    private final DirectwerkUserPrincipal principal;
    private final Long apiKeyId;
    private final Set<String> scopes;

    public TenantApiKeyAuthenticationToken(
            DirectwerkUserPrincipal principal,
            Long apiKeyId,
            Set<String> scopes,
            Collection<? extends GrantedAuthority> authorities
    ) {
        super(authorities);
        this.principal = principal;
        this.apiKeyId = apiKeyId;
        this.scopes = Set.copyOf(scopes);
        setAuthenticated(true);
    }

    public Long apiKeyId() {
        return apiKeyId;
    }

    public Set<String> scopes() {
        return scopes;
    }

    @Override
    public Object getCredentials() {
        return "";
    }

    @Override
    public Object getPrincipal() {
        return principal;
    }
}
