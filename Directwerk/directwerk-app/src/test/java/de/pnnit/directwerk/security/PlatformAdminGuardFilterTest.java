package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.exception.FilterExceptionResolver;
import de.pnnit.directwerk.modules.core.entity.PlatformAdmin;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.entity.UserStatus;
import de.pnnit.directwerk.modules.core.repository.PlatformAdminRepository;
import de.pnnit.directwerk.multitenancy.PlatformAdminAccessDeniedException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerExceptionResolver;

class PlatformAdminGuardFilterTest {

    private final PlatformAdminRepository platformAdminRepository = mock(PlatformAdminRepository.class);
    private final CurrentPlatformAdminService platformAdminService =
            new CurrentPlatformAdminService(platformAdminRepository);
    private final FilterExceptionResolver filterExceptionResolver =
            new FilterExceptionResolver(mock(HandlerExceptionResolver.class));
    private final PlatformAdminGuardFilter filter =
            new PlatformAdminGuardFilter(platformAdminService, filterExceptionResolver);

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void rejectsRevokedPlatformAdminOnPlatformPath() throws Exception {
        authenticatePlatformAdmin();
        when(platformAdminRepository.findByUserId(5L)).thenReturn(Optional.empty());

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/platform/tenants");
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(PlatformAdminAccessDeniedException.class);
        verifyNoInteractions(chain);
    }

    @Test
    void rejectsDisabledUserStillListedAsPlatformAdmin() throws Exception {
        authenticatePlatformAdmin();
        when(platformAdminRepository.findByUserId(5L)).thenReturn(Optional.of(admin(UserStatus.DISABLED)));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/platform/admins");
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(PlatformAdminAccessDeniedException.class);
    }

    @Test
    void allowsActivePlatformAdmin() throws Exception {
        authenticatePlatformAdmin();
        when(platformAdminRepository.findByUserId(5L)).thenReturn(Optional.of(admin(UserStatus.ACTIVE)));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/platform/tenants");
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test
    void allowsActivePlatformAdminOnSecurityProbe() throws Exception {
        authenticatePlatformAdmin();
        when(platformAdminRepository.findByUserId(5L)).thenReturn(Optional.of(admin(UserStatus.ACTIVE)));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/security/platform");
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test
    void skipsUnauthenticatedRequests() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/platform/tenants");
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        verifyNoInteractions(platformAdminRepository);
    }

    @Test
    void skipsWebhooksAndTenantPaths() {
        assertThat(PlatformAdminGuardFilter.isPlatformAdminPath("/api/v1/webhooks/stripe")).isFalse();
        assertThat(PlatformAdminGuardFilter.isPlatformAdminPath("/api/v1/tenant/users")).isFalse();
        assertThat(PlatformAdminGuardFilter.isPlatformAdminPath("/api/v1/me")).isFalse();
        assertThat(PlatformAdminGuardFilter.isPlatformAdminPath("/api/v1/platform/tenants")).isTrue();
        assertThat(PlatformAdminGuardFilter.isPlatformAdminPath("/api/v1/security/platform")).isTrue();
    }

    private static PlatformAdmin admin(UserStatus status) {
        User user = new User();
        user.setStatus(status);
        PlatformAdmin admin = new PlatformAdmin();
        admin.setUser(user);
        return admin;
    }

    private static void authenticatePlatformAdmin() {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                5L,
                "platform@example.com",
                "hash",
                null,
                List.of(new SimpleGrantedAuthority(RoleConstants.PLATFORM_ADMIN))
        );
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
    }
}
