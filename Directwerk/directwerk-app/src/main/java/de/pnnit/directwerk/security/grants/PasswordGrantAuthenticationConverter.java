package de.pnnit.directwerk.security.grants;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.web.authentication.AuthenticationConverter;
import org.springframework.util.StringUtils;

public class PasswordGrantAuthenticationConverter implements AuthenticationConverter {

    @Nullable
    @Override
    public Authentication convert(HttpServletRequest request) {
        var parameters = OAuth2EndpointUtils.getParameters(request);
        String grantType = OAuth2EndpointUtils.requireSingleParameter(parameters, OAuth2ParameterNames.GRANT_TYPE);
        if (!PasswordGrantAuthenticationToken.PASSWORD_GRANT_TYPE.getValue().equals(grantType)) {
            return null;
        }

        Authentication clientPrincipal = SecurityContextHolder.getContext().getAuthentication();
        if (clientPrincipal == null) {
            OAuth2EndpointUtils.throwError(
                    OAuth2ErrorCodes.INVALID_CLIENT,
                    OAuth2ParameterNames.CLIENT_ID,
                    OAuth2EndpointUtils.ACCESS_TOKEN_REQUEST_ERROR_URI
            );
        }

        String clientId = OAuth2EndpointUtils.requireSingleParameter(parameters, OAuth2ParameterNames.CLIENT_ID);
        if (!clientId.equals(clientPrincipal.getName())) {
            OAuth2EndpointUtils.throwError(
                    OAuth2ErrorCodes.INVALID_CLIENT,
                    OAuth2ParameterNames.CLIENT_ID,
                    OAuth2EndpointUtils.ACCESS_TOKEN_REQUEST_ERROR_URI
            );
        }

        Set<String> scopes = parseScopes(parameters);
        return new PasswordGrantAuthenticationToken(
                OAuth2EndpointUtils.requireSingleParameter(parameters, "username"),
                OAuth2EndpointUtils.requireSingleParameter(parameters, "password"),
                clientPrincipal,
                scopes
        );
    }

    private Set<String> parseScopes(org.springframework.util.MultiValueMap<String, String> parameters) {
        if (!parameters.containsKey(OAuth2ParameterNames.SCOPE)) {
            return null;
        }
        if (parameters.get(OAuth2ParameterNames.SCOPE).size() != 1) {
            OAuth2EndpointUtils.throwError(
                    OAuth2ErrorCodes.INVALID_REQUEST,
                    OAuth2ParameterNames.SCOPE,
                    OAuth2EndpointUtils.ACCESS_TOKEN_REQUEST_ERROR_URI
            );
        }

        String scope = parameters.getFirst(OAuth2ParameterNames.SCOPE);
        if (!StringUtils.hasText(scope)) {
            OAuth2EndpointUtils.throwError(
                    OAuth2ErrorCodes.INVALID_REQUEST,
                    OAuth2ParameterNames.SCOPE,
                    OAuth2EndpointUtils.ACCESS_TOKEN_REQUEST_ERROR_URI
            );
        }

        Set<String> scopes = new LinkedHashSet<>();
        for (String token : scope.trim().split("\\s+")) {
            if (!StringUtils.hasText(token)) {
                OAuth2EndpointUtils.throwError(
                        OAuth2ErrorCodes.INVALID_REQUEST,
                        OAuth2ParameterNames.SCOPE,
                        OAuth2EndpointUtils.ACCESS_TOKEN_REQUEST_ERROR_URI
                );
            }
            scopes.add(token);
        }
        return scopes.isEmpty() ? null : scopes;
    }
}
