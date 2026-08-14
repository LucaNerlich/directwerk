package de.pnnit.directwerk.security;

import de.pnnit.directwerk.api.exception.FilterExceptionResolver;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.multitenancy.PlatformTenantAccessDeniedException;
import de.pnnit.directwerk.multitenancy.TenantContextMissingException;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Re-validates ACTIVE tenant membership against the DB for authenticated tenant-scoped routes.
 *
 * <p>Complements JWT role claims (trusted until access-token expiry / refresh) by resolving the
 * current membership via {@link CurrentTenantMembershipService} from the Spring Security context
 * and Host-derived {@code TenantContext}.
 *
 * <p>Tenant-isolation violations detected here are resolved through {@link FilterExceptionResolver}
 * so callers receive the same {@code Response<T>} JSON envelope/status/error-code as any other
 * {@code @ExceptionHandler}-mapped exception — this filter runs before {@code DispatcherServlet},
 * so {@code @RestControllerAdvice} alone can never catch an exception thrown from here.
 */
@RequiredArgsConstructor
public class TenantMembershipGuardFilter extends OncePerRequestFilter {

    private final CurrentTenantMembershipService currentTenantMembershipService;
    private final FilterExceptionResolver filterExceptionResolver;

    /**
     * Validates active tenant membership for tenant-scoped routes before continuing the request.
     */
    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!requiresFreshMembership(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            TenantMembership membership = currentTenantMembershipService.requireActiveMembership();
            if (!hasRequiredRole(membership.getRoles(), path)) {
                throw new TenantMismatchException("Active tenant membership required");
            }
        } catch (TenantMismatchException | PlatformTenantAccessDeniedException | TenantContextMissingException ex) {
            filterExceptionResolver.resolve(request, response, ex);
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Determines whether a request path requires fresh tenant membership validation.
     *
     * @param path the request path
     * @return {@code true} for authenticated tenant-scoped API routes
     */
    private static boolean requiresFreshMembership(String path) {
        if (!SecurityUtils.isAuthenticated()) {
            return false;
        }
        if (path.startsWith("/api/v1/platform/") || "/api/v1/security/platform".equals(path)) {
            return false;
        }
        return path.startsWith("/api/v1/tenant/")
                || path.startsWith("/api/v1/probes/")
                || path.startsWith("/api/v1/me/")
                || "/api/v1/me".equals(path)
                || path.startsWith("/api/v1/security/");
    }

    /**
     * Role gate from <em>DB membership</em> (not JWT claims alone) for admin/editor routes.
     * {@code /me} and {@code /security} only need an ACTIVE membership; method security handles
     * finer role checks on security probes.
     */
    private static boolean hasRequiredRole(Set<Role> roles, String path) {
        if (roles == null || roles.isEmpty()) {
            return false;
        }
        if (path.startsWith("/api/v1/tenant/")) {
            return roles.contains(Role.TENANT_ADMIN);
        }
        if (path.startsWith("/api/v1/probes/")) {
            return roles.contains(Role.TENANT_ADMIN) || roles.contains(Role.EDITOR);
        }
        return true;
    }
}
