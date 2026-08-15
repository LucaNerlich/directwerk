package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.exception.FilterExceptionResolver;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.multitenancy.TenantMismatchException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerExceptionResolver;

class TenantMembershipGuardFilterTest {

    private final TenantMembershipRepository membershipRepository = mock(TenantMembershipRepository.class);
    private final CurrentTenantMembershipService membershipService =
            new CurrentTenantMembershipService(membershipRepository);
    // Mockito's mock returns null from resolveException(...) by default, i.e. "unresolved" —
    // so FilterExceptionResolver rethrows the original exception, same as before this class existed.
    private final FilterExceptionResolver filterExceptionResolver =
            new FilterExceptionResolver(mock(HandlerExceptionResolver.class));
    private final TenantMembershipGuardFilter filter =
            new TenantMembershipGuardFilter(membershipService, filterExceptionResolver);

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void rejectsDisabledMembershipOnTenantAdminPath() throws Exception {
        authenticate(1L);
        TenantContext.setTenantId(1L);
        TenantMembership membership = new TenantMembership();
        membership.setStatus(MembershipStatus.DISABLED);
        membership.setRoles(EnumSet.of(Role.TENANT_ADMIN));
        when(membershipRepository.findByUserIdAndTenantId(5L, 1L)).thenReturn(Optional.of(membership));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/tenant/users");
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(TenantMismatchException.class);
    }

    @Test
    void allowsActiveTenantAdmin() throws Exception {
        authenticate(1L);
        TenantContext.setTenantId(1L);
        TenantMembership membership = activeMembership(Role.TENANT_ADMIN);
        when(membershipRepository.findByUserIdAndTenantId(5L, 1L)).thenReturn(Optional.of(membership));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/tenant/users");
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test
    void rejectsDisabledMembershipOnMePath() throws Exception {
        authenticate(1L, RoleConstants.SUBSCRIBER);
        TenantContext.setTenantId(1L);
        TenantMembership membership = new TenantMembership();
        membership.setStatus(MembershipStatus.DISABLED);
        membership.setRoles(EnumSet.of(Role.SUBSCRIBER));
        when(membershipRepository.findByUserIdAndTenantId(5L, 1L)).thenReturn(Optional.of(membership));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/me/access");
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(TenantMismatchException.class);
    }

    @Test
    void allowsActiveMembershipOnMePath() throws Exception {
        authenticate(1L, RoleConstants.SUBSCRIBER);
        TenantContext.setTenantId(1L);
        when(membershipRepository.findByUserIdAndTenantId(5L, 1L))
                .thenReturn(Optional.of(activeMembership(Role.SUBSCRIBER)));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/me");
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);
        verify(membershipRepository).findByUserIdAndTenantId(5L, 1L);
        verify(chain).doFilter(request, response);
    }

    @Test
    void rejectsPrincipalTenantMismatchWithContext() throws Exception {
        authenticate(1L);
        TenantContext.setTenantId(2L);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/me");
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(TenantMismatchException.class);
    }

    @Test
    void skipsPlatformSecurityProbe() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/security/platform");
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test
    void rejectsSubscriberOnEditorContentPath() throws Exception {
        authenticate(1L, RoleConstants.SUBSCRIBER);
        TenantContext.setTenantId(1L);
        when(membershipRepository.findByUserIdAndTenantId(5L, 1L))
                .thenReturn(Optional.of(activeMembership(Role.SUBSCRIBER)));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/media/upload");
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(TenantMismatchException.class);
    }

    @Test
    void allowsActiveEditorOnContentPath() throws Exception {
        authenticate(1L, RoleConstants.EDITOR);
        TenantContext.setTenantId(1L);
        when(membershipRepository.findByUserIdAndTenantId(5L, 1L))
                .thenReturn(Optional.of(activeMembership(Role.EDITOR)));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/media/upload");
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test
    void rejectsDeactivatedEditorOnContentPath() throws Exception {
        authenticate(1L, RoleConstants.EDITOR);
        TenantContext.setTenantId(1L);
        TenantMembership membership = new TenantMembership();
        membership.setStatus(MembershipStatus.DISABLED);
        membership.setRoles(EnumSet.of(Role.EDITOR));
        when(membershipRepository.findByUserIdAndTenantId(5L, 1L)).thenReturn(Optional.of(membership));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/episodes/1");
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(TenantMismatchException.class);
    }

    private static TenantMembership activeMembership(Role role) {
        TenantMembership membership = new TenantMembership();
        membership.setStatus(MembershipStatus.ACTIVE);
        membership.setRoles(EnumSet.of(role));
        return membership;
    }

    private static void authenticate(Long tenantId) {
        authenticate(tenantId, RoleConstants.TENANT_ADMIN);
    }

    private static void authenticate(Long tenantId, String roleAuthority) {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                5L,
                "admin@example.com",
                "hash",
                tenantId,
                List.of(new SimpleGrantedAuthority(roleAuthority))
        );
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
    }
}
