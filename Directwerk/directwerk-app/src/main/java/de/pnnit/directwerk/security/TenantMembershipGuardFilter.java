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
        RequestScope scope = RequestScope.of(path);
        if (!SecurityUtils.isAuthenticated() || !scope.isTenantScoped()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            TenantMembership membership = currentTenantMembershipService.requireActiveMembership();
            if (!hasRequiredRole(membership.getRoles(), scope)) {
                throw new TenantMismatchException("Active tenant membership required");
            }
        } catch (TenantMismatchException | PlatformTenantAccessDeniedException | TenantContextMissingException ex) {
            filterExceptionResolver.resolve(request, response, ex);
            return;
        } catch (RuntimeException ex) {
            // Unexpected membership-lookup failures (e.g. membership store unavailable) must still
            // leave the API as the standard error envelope via the catch-all mapping — never as
            // the container's default error page, which this pre-dispatch filter would otherwise cause.
            filterExceptionResolver.resolve(request, response, ex);
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Role gate from <em>DB membership</em> (not JWT claims alone) — the DB check closes the
     * window where a deactivated or demoted member still holds a valid access token.
     *
     * <p>Note: {@code MEMBER} scope ({@code /me}, {@code /security}) intentionally accepts any
     * ACTIVE membership here; fine-grained roles on those routes come from method-level
     * {@code @PreAuthorize} on JWT claims. Access tokens live 15 minutes
     * ({@code OAuth2RegisteredClientFactory}), so a demotion takes effect at most 15 minutes
     * after it happens — the standard JWT tradeoff, refreshed membership state on refresh.
     */
    private static boolean hasRequiredRole(Set<Role> roles, RequestScope scope) {
        if (roles == null || roles.isEmpty()) {
            return false;
        }
        return switch (scope.roleRequirement()) {
            case NONE -> true;
            case TENANT_ADMIN -> roles.contains(Role.TENANT_ADMIN);
            case EDITOR_OR_TENANT_ADMIN -> roles.contains(Role.TENANT_ADMIN) || roles.contains(Role.EDITOR);
            case ANY_ACTIVE -> true;
        };
    }
}
