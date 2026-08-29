package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.multitenancy.PlatformTenantAccessDeniedException;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class SecurityUtilsTest {

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void currentPrincipalReturnsNullWhenUnauthenticated() {
        assertThat(SecurityUtils.currentPrincipal()).isNull();
        assertThat(SecurityUtils.currentUserId()).isNull();
        assertThat(SecurityUtils.isAuthenticated()).isFalse();
    }

    @Test
    void readsDirectwerkUserPrincipalFromSecurityContext() {
        DirectwerkUserPrincipal principal = principal(10L, 1L);
        authenticate(principal);

        assertThat(SecurityUtils.currentPrincipal()).isSameAs(principal);
        assertThat(SecurityUtils.currentUserId()).isEqualTo(10L);
        assertThat(SecurityUtils.isAuthenticated()).isTrue();
    }

    @Test
    void requirePrincipalThrowsWhenMissing() {
        assertThatThrownBy(SecurityUtils::requirePrincipal)
                .isInstanceOf(TenantMismatchException.class)
                .hasMessageContaining("Authentication required");
    }

    @Test
    void requireTenantPrincipalRejectsPlatformAdminWithoutTenant() {
        DirectwerkUserPrincipal platformAdmin = new DirectwerkUserPrincipal(
                1L,
                "admin@example.com",
                "hash",
                null,
                List.of(new SimpleGrantedAuthority(RoleConstants.PLATFORM_ADMIN))
        );
        authenticate(platformAdmin);

        assertThatThrownBy(SecurityUtils::requireTenantPrincipal)
                .isInstanceOf(PlatformTenantAccessDeniedException.class);
    }

    @Test
    void requireTenantPrincipalReturnsTenantScopedPrincipal() {
        DirectwerkUserPrincipal principal = principal(10L, 1L);
        authenticate(principal);

        assertThat(SecurityUtils.requireTenantPrincipal()).isSameAs(principal);
        assertThat(SecurityUtils.requireTenantPrincipal(principal)).isSameAs(principal);
    }

    @Test
    void anonymousAuthenticationIsNotAuthenticated() {
        AnonymousAuthenticationToken anonymous = new AnonymousAuthenticationToken(
                "key",
                "anonymous",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))
        );
        SecurityContextHolder.getContext().setAuthentication(anonymous);

        assertThat(SecurityUtils.isAuthenticated()).isFalse();
        assertThat(SecurityUtils.currentPrincipal()).isNull();
    }

    private static void authenticate(DirectwerkUserPrincipal principal) {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
    }

    private static DirectwerkUserPrincipal principal(Long userId, Long tenantId) {
        return new DirectwerkUserPrincipal(
                userId,
                "user-" + userId + "@example.com",
                "hash",
                tenantId,
                List.of(new SimpleGrantedAuthority(RoleConstants.TENANT_ADMIN))
        );
    }
}
