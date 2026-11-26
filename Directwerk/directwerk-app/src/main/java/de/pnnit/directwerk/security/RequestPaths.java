package de.pnnit.directwerk.security;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import org.springframework.web.util.UriUtils;

/**
 * One decoded, application-relative path for every servlet filter.
 *
 * <p>Tomcat filter mapping, Spring Security {@code PathPattern} matching and MVC dispatch all
 * resolve percent-encoded characters; a guard that reads {@link HttpServletRequest#getRequestURI()}
 * authorizes a different path than the one that runs (#1014).
 */
public final class RequestPaths {

    private RequestPaths() {
    }

    /** @return the request path with the context path removed and percent-encoding decoded */
    public static String of(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null || uri.isEmpty()) {
            return "/";
        }
        String contextPath = request.getContextPath();
        String path = contextPath != null && !contextPath.isEmpty() && uri.startsWith(contextPath)
                ? uri.substring(contextPath.length())
                : uri;
        return UriUtils.decode(path, StandardCharsets.UTF_8);
    }
}
