package de.pnnit.directwerk.security;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds {@code Response<T>}-shaped error bodies for failures raised inside the Spring Security
 * filter chain, where {@code @RestControllerAdvice} cannot reach. Kept as plain maps (instead of
 * the {@code Response} record) so the entry point and denied handler share one serializer without
 * depending on the web layer's generics.
 */
final class SecurityErrorBody {

    private SecurityErrorBody() {
    }

    static Map<String, Object> unauthorized() {
        return envelope(401, "UNAUTHORIZED", "Authentication required");
    }

    static Map<String, Object> accessDenied() {
        return envelope(403, "ACCESS_DENIED", "Forbidden");
    }

    private static Map<String, Object> envelope(int statusCode, String code, String message) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("message", message);
        error.put("field", null);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("statusCode", statusCode);
        body.put("statusMessage", code);
        body.put("data", null);
        body.put("errors", List.of(error));
        body.put("metadata", Map.of());
        return body;
    }
}
