package de.pnnit.directwerk.security.grants;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
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

    public static void throwError(String errorCode, String parameterName, String errorUri) {
        OAuth2Error error = new OAuth2Error(errorCode, "OAuth 2.0 Parameter: " + parameterName, errorUri);
        throw new OAuth2AuthenticationException(error);
    }
}
