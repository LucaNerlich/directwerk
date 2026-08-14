package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.multitenancy.PlatformTenantAccessDeniedException;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.multitenancy.TenantContextMissingException;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class CurrentTenantMembershipServiceTest {

    private final TenantMembershipRepository membershipRepository = mock(TenantMembershipRepository.class);
    private final CurrentTenantMembershipService service =
            new CurrentTenantMembershipService(membershipRepository);

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void returnsActiveMembershipWhenSecurityContextMatchesTenantContext() {
        authenticate(1L);
        TenantContext.setTenantId(1L);
        TenantMembership membership = membership(MembershipStatus.ACTIVE, Role.EDITOR);
        when(membershipRepository.findByUserIdAndTenantId(5L, 1L)).thenReturn(Optional.of(membership));

        assertThat(service.requireActiveMembership()).isSameAs(membership);
    }

    @Test
    void rejectsWhenSecurityContextTenantDiffersFromTenantContext() {
        authenticate(1L);
        TenantContext.setTenantId(2L);

        assertThatThrownBy(service::requireActiveMembership)
                .isInstanceOf(TenantMismatchException.class);
    }

    @Test
    void rejectsDisabledMembership() {
        authenticate(1L);
        TenantContext.setTenantId(1L);
        when(membershipRepository.findByUserIdAndTenantId(5L, 1L))
                .thenReturn(Optional.of(membership(MembershipStatus.DISABLED, Role.SUBSCRIBER)));

        assertThatThrownBy(service::requireActiveMembership)
                .isInstanceOf(TenantMismatchException.class)
                .hasMessageContaining("no longer active");
    }

    @Test
    void rejectsPlatformPrincipalWithoutTenant() {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                9L,
                "admin@example.com",
                "hash",
                null,
                List.of(new SimpleGrantedAuthority(RoleConstants.PLATFORM_ADMIN))
        );
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
        TenantContext.setTenantId(1L);

        assertThatThrownBy(service::requireActiveMembership)
                .isInstanceOf(PlatformTenantAccessDeniedException.class);
    }

    @Test
    void rejectsMissingTenantContext() {
        authenticate(1L);

        assertThatThrownBy(service::requireActiveMembership)
                .isInstanceOf(TenantContextMissingException.class);
    }

    private static TenantMembership membership(MembershipStatus status, Role role) {
        TenantMembership membership = new TenantMembership();
        membership.setStatus(status);
        membership.setRoles(EnumSet.of(role));
        return membership;
    }

    private static void authenticate(Long tenantId) {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                5L,
                "user@example.com",
                "hash",
                tenantId,
                List.of(new SimpleGrantedAuthority(RoleConstants.EDITOR))
        );
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
    }
}
