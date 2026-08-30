package de.pnnit.directwerk.security;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.multitenancy.TenantRoutingHostResolver;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Chooses platform-admin vs tenant login for {@code /oauth2/token} password grants.
 *
 * <p>Platform-admin login applies only when the OAuth client is the platform client <em>and</em>
 * tenant routing resolves to the platform API hostname. Shared studio logins always carry
 * {@code X-Tenant-Host} and must issue tenant-scoped tokens even if the wrong client id is
 * configured on the BFF.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@RequiredArgsConstructor
public class LoginContextFilter extends OncePerRequestFilter {

    private final DirectwerkConfig directwerkConfig;
    private final TenantRoutingHostResolver tenantRoutingHostResolver;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (!"/oauth2/token".equals(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }
        try {
            String clientId = request.getParameter("client_id");
            boolean platformClient = directwerkConfig.security().platformClientId().equals(clientId);
            boolean platformApiHost = tenantRoutingHostResolver.resolvesToPlatformApiHost(request);
            LoginContext.setPlatformAdminLogin(platformClient && platformApiHost);
            filterChain.doFilter(request, response);
        } finally {
            LoginContext.clear();
        }
    }
}
