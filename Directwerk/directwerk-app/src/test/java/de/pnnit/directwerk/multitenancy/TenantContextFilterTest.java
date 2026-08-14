package de.pnnit.directwerk.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.exception.FilterExceptionResolver;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
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

class TenantContextFilterTest {

    private final TenantResolver tenantResolver = mock(TenantResolver.class);
    // Mockito's mock returns null from resolveException(...) by default, i.e. "unresolved" —
    // so FilterExceptionResolver rethrows the original exception, same as before this class existed.
    private final FilterExceptionResolver filterExceptionResolver =
            new FilterExceptionResolver(mock(HandlerExceptionResolver.class));
    private final TenantContextFilter filter = new TenantContextFilter(tenantResolver, filterExceptionResolver);

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void rejectsSecurityContextTenantMismatchAgainstHost() throws Exception {
        Tenant hostTenant = tenant(2L, TenantStatus.ACTIVE);
        when(tenantResolver.requireActiveHost("tenant-b.localhost")).thenReturn(hostTenant);
        authenticateTenantUser(1L);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/tenant/users");
        when(request.getServerName()).thenReturn("tenant-b.localhost");
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(TenantMismatchException.class);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void setsTenantContextWhenSecurityContextTenantMatchesHost() throws Exception {
        Tenant hostTenant = tenant(1L, TenantStatus.ACTIVE);
        when(tenantResolver.requireActiveHost("tenant-a.localhost")).thenReturn(hostTenant);
        authenticateTenantUser(1L);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/tenant/users");
        when(request.getServerName()).thenReturn("tenant-a.localhost");
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();
        doAnswer(invocation -> {
            assertThat(TenantContext.getTenantId()).isEqualTo(1L);
            return null;
        }).when(chain).doFilter(request, response);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void allowsMultiMembershipUserWhenTokenMatchesSelectedHost() throws Exception {
        // User may belong to A and B; token issued for B is valid only on Host B.
        Tenant hostTenant = tenant(2L, TenantStatus.ACTIVE);
        when(tenantResolver.requireActiveHost("tenant-b.localhost")).thenReturn(hostTenant);
        authenticateTenantUser(2L);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/me");
        when(request.getServerName()).thenReturn("tenant-b.localhost");
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();
        doAnswer(invocation -> {
            assertThat(TenantContext.getTenantId()).isEqualTo(2L);
            return null;
        }).when(chain).doFilter(request, response);

        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void clearsContextForStripeWebhookPath() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/webhooks/stripe");
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void clearsContextForPlatformPaths() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/platform/tenants");
        FilterChain chain = mock(FilterChain.class);

        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void rejectsPlatformAdminOnMe() throws Exception {
        authenticatePlatformAdmin();

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/me");
        when(request.getServerName()).thenReturn("tenant-a.localhost");
        when(tenantResolver.requireActiveHost("tenant-a.localhost")).thenReturn(tenant(1L, TenantStatus.ACTIVE));
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(PlatformTenantAccessDeniedException.class);
    }

    @Test
    void rejectsPlatformAdminOnTenantScopedSecurityProbe() throws Exception {
        authenticatePlatformAdmin();

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/security/context");
        when(request.getServerName()).thenReturn("tenant-a.localhost");
        when(tenantResolver.requireActiveHost("tenant-a.localhost")).thenReturn(tenant(1L, TenantStatus.ACTIVE));
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(PlatformTenantAccessDeniedException.class);
    }

    @Test
    void clearsContextForPlatformSecurityProbeWithoutHostBinding() throws Exception {
        authenticatePlatformAdmin();

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/security/platform");
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void rejectsAuthenticatedPrincipalWithoutTenantClaim() throws Exception {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                9L,
                "user@example.com",
                "hash",
                null,
                List.of(new SimpleGrantedAuthority(RoleConstants.TENANT_ADMIN))
        );
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
        when(tenantResolver.requireActiveHost("tenant-a.localhost")).thenReturn(tenant(1L, TenantStatus.ACTIVE));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/me/access");
        when(request.getServerName()).thenReturn("tenant-a.localhost");
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(PlatformTenantAccessDeniedException.class);
    }

    @Test
    void publicPathRejectsSuspendedTenant() throws Exception {
        Tenant suspended = tenant(1L, TenantStatus.SUSPENDED);
        when(tenantResolver.resolveHost("suspended.localhost")).thenReturn(Optional.of(suspended));

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/public/site-config");
        when(request.getServerName()).thenReturn("suspended.localhost");
        FilterChain chain = mock(FilterChain.class);

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), chain))
                .isInstanceOf(TenantSuspendedException.class);
    }

    private static void authenticateTenantUser(Long tenantId) {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                5L,
                "user@example.com",
                "hash",
                tenantId,
                List.of(new SimpleGrantedAuthority(RoleConstants.TENANT_ADMIN))
        );
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
    }

    private static void authenticatePlatformAdmin() {
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
    }

    private static Tenant tenant(Long id, TenantStatus status) {
        Tenant tenant = new Tenant();
        tenant.setId(id);
        tenant.setSlug("tenant-" + id);
        tenant.setName("Tenant " + id);
        tenant.setStatus(status);
        return tenant;
    }
}
