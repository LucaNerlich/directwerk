package de.pnnit.directwerk.security;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

/** Shared 429 response body for the auth and billing rate-limit filters. */
final class RateLimitResponses {

    private RateLimitResponses() {
    }

    static void writeTooManyRequests(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(
                "{\"status\":429,\"code\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests\"}"
        );
    }
}
