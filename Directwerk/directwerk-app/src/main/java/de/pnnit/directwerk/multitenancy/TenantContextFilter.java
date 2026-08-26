package de.pnnit.directwerk.multitenancy;

import de.pnnit.directwerk.api.exception.FilterExceptionResolver;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
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
            if (isPlatformScopedPath(path)) {
                TenantContext.clear();
            } else if (isPublicPath(path)) {
                tenantResolver.resolveHost(request.getServerName())
                        .ifPresent(tenant -> {
                            ensureTenantActive(tenant, request.getServerName());
                            TenantContext.setTenantId(tenant.getId());
                        });
            } else if (requiresTenantContext(path)) {
                Tenant tenant = tenantResolver.requireActiveHost(request.getServerName());
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
                | TenantSuspendedException | TenantNotFoundException ex) {
            TenantContext.clear();
            filterExceptionResolver.resolve(request, response, ex);
            return false;
        }
    }

    private static void ensureTenantActive(Tenant tenant, String host) {
        if (!tenant.isActive()) {
            throw new TenantSuspendedException(host);
        }
    }

    private boolean isPublicPath(String path) {
        return path.startsWith("/api/v1/public/")
                || path.startsWith("/api/v1/auth/")
                || path.startsWith("/feeds/")
                || path.startsWith("/actuator/")
                || path.startsWith("/swagger-ui")
                || path.startsWith("/v3/api-docs");
    }

    private boolean isPlatformScopedPath(String path) {
        return path.startsWith("/api/v1/platform/")
                || path.startsWith("/api/v1/webhooks/")
                || "/api/v1/security/platform".equals(path);
    }

    private boolean requiresTenantContext(String path) {
        return path.startsWith("/api/v1/")
                && !isPlatformScopedPath(path);
    }
}
