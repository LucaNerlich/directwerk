package de.pnnit.directwerk.security;

import de.pnnit.directwerk.multitenancy.PlatformTenantAccessDeniedException;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Helpers for reading the authenticated {@link DirectwerkUserPrincipal} from Spring Security's
 * {@link SecurityContextHolder}. Prefer these over ad-hoc principal casts so tenant membership
 * always flows from the security context.
 */
public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static DirectwerkUserPrincipal currentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof DirectwerkUserPrincipal principal)) {
            return null;
        }
        return principal;
    }

    /**
     * @return {@code true} when the security context holds a non-anonymous authenticated principal
     */
    public static boolean isAuthenticated() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
    }

    /**
     * @return the authenticated principal
     * @throws TenantMismatchException if no authenticated {@link DirectwerkUserPrincipal} is present
     */
    public static DirectwerkUserPrincipal requirePrincipal() {
        DirectwerkUserPrincipal principal = currentPrincipal();
        if (principal == null) {
            throw new TenantMismatchException("Authentication required");
        }
        return principal;
    }

    /**
     * Requires a tenant-scoped principal (not a platform-admin / no-tenant token).
     *
     * @return the authenticated tenant principal
     * @throws PlatformTenantAccessDeniedException if the principal has no tenant membership claim
     * @throws TenantMismatchException if no authenticated principal is present
     */
    public static DirectwerkUserPrincipal requireTenantPrincipal() {
        return requireTenantPrincipal(requirePrincipal());
    }

    /**
     * Validates a principal already resolved (e.g. via {@code @AuthenticationPrincipal}).
     *
     * @param principal the authenticated principal, or {@code null}
     * @return the tenant-scoped principal
     * @throws PlatformTenantAccessDeniedException if the principal has no tenant membership claim
     * @throws TenantMismatchException if {@code principal} is {@code null}
     */
    public static DirectwerkUserPrincipal requireTenantPrincipal(DirectwerkUserPrincipal principal) {
        if (principal == null) {
            throw new TenantMismatchException("Authentication required");
        }
        if (principal.tenantId() == null) {
            throw new PlatformTenantAccessDeniedException();
        }
        return principal;
    }

    public static Long currentUserId() {
        DirectwerkUserPrincipal principal = currentPrincipal();
        return principal != null ? principal.userId() : null;
    }
}
