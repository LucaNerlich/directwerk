package de.pnnit.directwerk.multitenancy;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

final class RoutingHostHttpServletRequest extends HttpServletRequestWrapper {

    private final String routingHost;

    RoutingHostHttpServletRequest(HttpServletRequest request, String routingHost) {
        super(request);
        this.routingHost = routingHost;
    }

    @Override
    public String getServerName() {
        return routingHost;
    }
}
