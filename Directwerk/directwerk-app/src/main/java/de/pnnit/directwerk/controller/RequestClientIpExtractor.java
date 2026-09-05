package de.pnnit.directwerk.controller;

import de.pnnit.directwerk.modules.core.util.ClientIpExtractor;
import jakarta.servlet.http.HttpServletRequest;

/** Extracts analytics client IP values from an HTTP request. */
public final class RequestClientIpExtractor {

    private RequestClientIpExtractor() {
    }

    /**
     * Extracts the client IP address from an HTTP request.
     *
     * @param request the HTTP request
     * @return the extracted client IP address
     */
    public static String extract(HttpServletRequest request) {
        return ClientIpExtractor.extract(
                request.getHeader("X-Forwarded-For"),
                request.getHeader("X-Real-IP"),
                request.getRemoteAddr());
    }
}
