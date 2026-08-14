package de.pnnit.directwerk.security.grants;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationGrantAuthenticationToken;

public class PasswordGrantAuthenticationToken extends OAuth2AuthorizationGrantAuthenticationToken {

    public static final AuthorizationGrantType PASSWORD_GRANT_TYPE = new AuthorizationGrantType("password");

    private final String username;
    private final String password;
    private final java.util.Set<String> scopes;

    public PasswordGrantAuthenticationToken(
            String username,
            String password,
            Authentication clientPrincipal,
            java.util.Set<String> scopes
    ) {
        super(PASSWORD_GRANT_TYPE, clientPrincipal, null);
        this.username = username;
        this.password = password;
        this.scopes = scopes;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }

    public java.util.Set<String> getScopes() {
        return scopes;
    }
}
