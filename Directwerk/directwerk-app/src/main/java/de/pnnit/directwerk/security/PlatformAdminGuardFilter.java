package de.pnnit.directwerk.security;

import de.pnnit.directwerk.api.exception.FilterExceptionResolver;
import de.pnnit.directwerk.multitenancy.PlatformAdminAccessDeniedException;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Re-validates platform-admin grant against the DB for authenticated platform-admin routes.
 *
 * <p>Mirrors {@link TenantMembershipGuardFilter}: JWT role claims alone would leave a
 * revoked or disabled platform admin able to call {@code /api/v1/platform/**} until the
 * access token expires (~15 minutes). This filter closes that window.
 */
@RequiredArgsConstructor
public class PlatformAdminGuardFilter extends OncePerRequestFilter {

    private final CurrentPlatformAdminService currentPlatformAdminService;
    private final FilterExceptionResolver filterExceptionResolver;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!SecurityUtils.isAuthenticated() || !isPlatformAdminPath(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            currentPlatformAdminService.requireActivePlatformAdmin();
        } catch (PlatformAdminAccessDeniedException | TenantMismatchException ex) {
            filterExceptionResolver.resolve(request, response, ex);
            return;
        } catch (RuntimeException ex) {
            filterExceptionResolver.resolve(request, response, ex);
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Platform-admin API surface only — not webhooks ({@code /api/v1/webhooks/**}), which are
     * classified as {@link RequestScope#PLATFORM} for tenant-context clearing but are unauthenticated.
     */
    static boolean isPlatformAdminPath(String path) {
        if (path == null) {
            return false;
        }
        return path.startsWith("/api/v1/platform/")
                || "/api/v1/security/platform".equals(path);
    }
}
