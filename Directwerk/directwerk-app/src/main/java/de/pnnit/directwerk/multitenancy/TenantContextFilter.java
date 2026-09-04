package de.pnnit.directwerk.multitenancy;

import de.pnnit.directwerk.api.exception.FilterExceptionResolver;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RequestScope;
import de.pnnit.directwerk.security.SecurityUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Establishes {@link TenantContext} from the verified Host (never from client tenant headers).
 *
 * <p>For authenticated tenant-scoped requests, the Spring Security principal's
 * {@link DirectwerkUserPrincipal#tenantId()} must be present and equal the Host tenant.
 * Platform-admin / no-tenant tokens cannot obtain a tenant context on tenant-scoped paths.
 *
 * <p>Tenant-isolation violations detected here are resolved through {@link FilterExceptionResolver}
 * so callers receive the same {@code Response<T>} JSON envelope/status/error-code as any other
 * {@code @ExceptionHandler}-mapped exception — this filter runs before {@code DispatcherServlet},
 * so {@code @RestControllerAdvice} alone can never catch an exception thrown from here.
 */
@RequiredArgsConstructor
public class TenantContextFilter extends OncePerRequestFilter {

    private final TenantResolver tenantResolver;
    private final FilterExceptionResolver filterExceptionResolver;
    private final TenantRoutingHostResolver tenantRoutingHostResolver;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            if (!establishTenantContext(request, response)) {
                return;
            }
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Resolves the tenant context for this request.
     *
     * @return {@code true} if the request should continue down the filter chain; {@code false}
     *         if a tenant-isolation violation was caught and already resolved into an HTTP
     *         error response (the caller must not continue the chain in that case)
     */
    private boolean establishTenantContext(HttpServletRequest request, HttpServletResponse response) {
        try {
            String path = request.getRequestURI();
            RequestScope scope = RequestScope.of(path);
            if (scope == RequestScope.PLATFORM) {
                TenantContext.clear();
            } else if (scope == RequestScope.PUBLIC) {
                tenantResolver.resolveHost(routingHost(request))
                        .ifPresent(tenant -> {
                            ensureTenantActive(tenant, routingHost(request));
                            TenantContext.setTenantId(tenant.getId());
                        });
            } else if (scope.isTenantScoped()) {
                Tenant tenant = tenantResolver.requireActiveHost(routingHost(request));
                if (SecurityUtils.isAuthenticated()) {
                    // Authenticated tenant routes must bind to the membership in SecurityContext —
                    // never accept Host alone (or a spoofed client tenant header).
                    DirectwerkUserPrincipal principal = SecurityUtils.currentPrincipal();
                    if (principal == null || principal.tenantId() == null) {
                        throw new PlatformTenantAccessDeniedException();
                    }
                    if (!principal.tenantId().equals(tenant.getId())) {
                        throw new TenantMismatchException();
                    }
                }
                TenantContext.setTenantId(tenant.getId());
            }
            return true;
        } catch (TenantMismatchException | PlatformTenantAccessDeniedException
                | TenantSuspendedException | TenantNotFoundException | TenantContextMissingException ex) {
            TenantContext.clear();
            filterExceptionResolver.resolve(request, response, ex);
            return false;
        } catch (RuntimeException ex) {
            // Unexpected resolution failures (e.g. tenant store unavailable) must still leave the
            // API as the standard error envelope via the catch-all mapping — never as the
            // container's default error page, which this pre-dispatch filter would otherwise cause.
            TenantContext.clear();
            filterExceptionResolver.resolve(request, response, ex);
            return false;
        }
    }

    private String routingHost(HttpServletRequest request) {
        return tenantRoutingHostResolver.resolve(request);
    }

    private static void ensureTenantActive(Tenant tenant, String host) {
        if (!tenant.isActive()) {
            throw new TenantSuspendedException(host);
        }
    }
}
