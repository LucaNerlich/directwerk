package de.pnnit.directwerk.multitenancy;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rewrites {@link HttpServletRequest#getServerName()} for BFF calls that target the platform API
 * hostname but carry the tenant domain in forwarded headers.
 */
@RequiredArgsConstructor
public class BffTenantRoutingHostFilter extends OncePerRequestFilter {

    private final TenantRoutingHostResolver tenantRoutingHostResolver;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String routingHost = tenantRoutingHostResolver.resolve(request);
        if (!routingHost.equalsIgnoreCase(request.getServerName())) {
            filterChain.doFilter(new RoutingHostHttpServletRequest(request, routingHost), response);
            return;
        }
        filterChain.doFilter(request, response);
    }
}
