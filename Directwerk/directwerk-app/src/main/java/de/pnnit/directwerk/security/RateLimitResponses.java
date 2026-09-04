package de.pnnit.directwerk.security;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

/** Shared 429 response body for the auth and billing rate-limit filters. */
final class RateLimitResponses {

    private RateLimitResponses() {
    }

    /**
     * Writes a {@code 429} using the same {@code Response<T>} error envelope as every other API
     * failure ({@code statusCode}/{@code statusMessage} plus an {@code errors} array), so rate
     * limiting stays machine-readable for integrators. The fixed window is one minute, hence the
     * {@code Retry-After: 60} hint.
     */
    static void writeTooManyRequests(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Retry-After", "60");
        response.getWriter().write(
                "{\"statusCode\":429,"
                        + "\"statusMessage\":\"RATE_LIMIT_EXCEEDED\","
                        + "\"data\":null,"
                        + "\"errors\":[{\"code\":\"RATE_LIMIT_EXCEEDED\","
                        + "\"message\":\"Too many requests\","
                        + "\"field\":null}],"
                        + "\"metadata\":{}}"
        );
    }
}
