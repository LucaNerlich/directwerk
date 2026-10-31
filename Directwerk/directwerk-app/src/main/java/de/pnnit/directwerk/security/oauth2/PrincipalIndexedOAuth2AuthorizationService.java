package de.pnnit.directwerk.security.oauth2;

import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.lang.Nullable;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;

/**
 * Indexes authorizations by principal name so password-change revocation can
 * remove every stored refresh grant without a store-specific query API.
 * {@link org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService}
 * itself has no find-by-principal method.
 */
public final class PrincipalIndexedOAuth2AuthorizationService implements OAuth2AuthorizationService {

    private final OAuth2AuthorizationService delegate;
    private final ConcurrentMap<String, Set<String>> idsByPrincipal = new ConcurrentHashMap<>();

    public PrincipalIndexedOAuth2AuthorizationService(OAuth2AuthorizationService delegate) {
        this.delegate = Objects.requireNonNull(delegate);
    }

    @Override
    public void save(OAuth2Authorization authorization) {
        OAuth2Authorization previous = delegate.findById(authorization.getId());
        if (previous != null) {
            unindex(previous);
        }
        delegate.save(authorization);
        index(authorization);
    }

    @Override
    public void remove(OAuth2Authorization authorization) {
        delegate.remove(authorization);
        unindex(authorization);
    }

    @Override
    @Nullable
    public OAuth2Authorization findById(String id) {
        return delegate.findById(id);
    }

    @Override
    @Nullable
    public OAuth2Authorization findByToken(String token, @Nullable OAuth2TokenType tokenType) {
        return delegate.findByToken(token, tokenType);
    }

    /**
     * Removes every authorization indexed under {@code principalName}.
     *
     * @return how many authorizations were removed
     */
    public int removeByPrincipalName(String principalName) {
        Objects.requireNonNull(principalName);
        Set<String> ids = idsByPrincipal.remove(principalName);
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        int removed = 0;
        for (String id : ids) {
            OAuth2Authorization authorization = delegate.findById(id);
            if (authorization != null) {
                delegate.remove(authorization);
                removed++;
            }
        }
        return removed;
    }

    private void index(OAuth2Authorization authorization) {
        idsByPrincipal
                .computeIfAbsent(authorization.getPrincipalName(), ignored -> ConcurrentHashMap.newKeySet())
                .add(authorization.getId());
    }

    private void unindex(OAuth2Authorization authorization) {
        Set<String> ids = idsByPrincipal.get(authorization.getPrincipalName());
        if (ids == null) {
            return;
        }
        ids.remove(authorization.getId());
        if (ids.isEmpty()) {
            idsByPrincipal.remove(authorization.getPrincipalName(), ids);
        }
    }
}
