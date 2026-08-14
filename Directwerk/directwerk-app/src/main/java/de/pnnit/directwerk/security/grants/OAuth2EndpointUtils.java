package de.pnnit.directwerk.security.grants;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;

public final class OAuth2EndpointUtils {

    public static final String ACCESS_TOKEN_REQUEST_ERROR_URI = "https://datatracker.ietf.org/doc/html/rfc6749#section-5.2";

    private OAuth2EndpointUtils() {
    }

    public static MultiValueMap<String, String> getParameters(HttpServletRequest request) {
        Map<String, String[]> parameterMap = request.getParameterMap();
        MultiValueMap<String, String> parameters = new LinkedMultiValueMap<>(parameterMap.size());
        parameterMap.forEach((key, values) -> {
            if (values.length > 0) {
                for (String value : values) {
                    parameters.add(key, value);
                }
            }
        });
        return parameters;
    }

    public static Map<String, Object> getParametersIfMatchesAuthorizationCodeGrantRequest(
            HttpServletRequest request,
            String... exclusions
    ) {
        if (!matchesAuthorizationCodeGrantRequest(request)) {
            return Collections.emptyMap();
        }
        Map<String, Object> parameters = new HashMap<>(getParameters(request).toSingleValueMap());
        for (String exclusion : exclusions) {
            parameters.remove(exclusion);
        }
        return parameters;
    }

    public static boolean matchesAuthorizationCodeGrantRequest(HttpServletRequest request) {
        MultiValueMap<String, String> parameters = getParameters(request);
        return hasSingleNonBlankValue(
                parameters,
                OAuth2ParameterNames.GRANT_TYPE,
                AuthorizationGrantType.AUTHORIZATION_CODE.getValue()
        ) && hasSingleNonBlankValue(parameters, OAuth2ParameterNames.CODE, null);
    }

    public static String requireSingleParameter(
            MultiValueMap<String, String> parameters,
            String parameterName
    ) {
        List<String> values = parameters.get(parameterName);
        if (values == null || values.isEmpty() || values.size() != 1) {
            throwError(OAuth2ErrorCodes.INVALID_REQUEST, parameterName, ACCESS_TOKEN_REQUEST_ERROR_URI);
        }
        String value = values.getFirst();
        if (!StringUtils.hasText(value)) {
            throwError(OAuth2ErrorCodes.INVALID_REQUEST, parameterName, ACCESS_TOKEN_REQUEST_ERROR_URI);
        }
        return value;
    }

    private static boolean hasSingleNonBlankValue(
            MultiValueMap<String, String> parameters,
            String parameterName,
            String expectedValue
    ) {
        List<String> values = parameters.get(parameterName);
        if (values == null || values.size() != 1) {
            return false;
        }
        String value = values.getFirst();
        if (!StringUtils.hasText(value)) {
            return false;
        }
        return expectedValue == null || expectedValue.equals(value);
    }

    public static void throwError(String errorCode, String parameterName, String errorUri) {
        OAuth2Error error = new OAuth2Error(errorCode, "OAuth 2.0 Parameter: " + parameterName, errorUri);
        throw new OAuth2AuthenticationException(error);
    }
}
