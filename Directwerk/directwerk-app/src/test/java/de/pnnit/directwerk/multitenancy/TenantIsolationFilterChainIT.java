package de.pnnit.directwerk.multitenancy;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Exercises tenant-isolation violations through the <em>real</em> servlet filter chain — not a
 * direct {@code filter.doFilter(...)} unit-test call, and not a direct
 * {@code GlobalExceptionHandler} method call — to guard the seam between
 * {@link TenantContextFilter} (a plain servlet {@link jakarta.servlet.Filter} that runs before
 * {@code DispatcherServlet} even begins dispatching) throwing, and that exception actually being
 * translated into the documented {@code Response<T>} JSON envelope with the correct HTTP status
 * and error code.
 *
 * <p>Mirrors the manual test harness scenarios in {@code http/15-multi-tenant-isolation.http}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TenantIsolationFilterChainIT {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TenantResolver tenantResolver;

    @Test
    void tenantATokenOnTenantBHostReturnsTenantMismatchEnvelope() throws Exception {
        Tenant tenantB = activeTenant(2L, "tenant-b");
        when(tenantResolver.requireActiveHost("tenant-b.localhost")).thenReturn(tenantB);

        Authentication tenantAUser = tenantPrincipal(1L, RoleConstants.TENANT_ADMIN);

        mockMvc.perform(get(URI.create("http://tenant-b.localhost/api/v1/tenant/branding"))
                        .with(authentication(tenantAUser)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.statusCode").value(403))
                .andExpect(jsonPath("$.errors[0].code").value("TENANT_MISMATCH"));
    }

    @Test
    void platformAdminTokenOnTenantScopedHostReturnsPlatformTenantAccessDeniedEnvelope() throws Exception {
        Tenant tenantA = activeTenant(1L, "tenant-a");
        when(tenantResolver.requireActiveHost("tenant-a.localhost")).thenReturn(tenantA);

        Authentication platformAdmin = platformAdminPrincipal(9L);

        mockMvc.perform(get(URI.create("http://tenant-a.localhost/api/v1/me"))
                        .with(authentication(platformAdmin)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.statusCode").value(403))
                .andExpect(jsonPath("$.errors[0].code").value("PLATFORM_TENANT_ACCESS_DENIED"));
    }

    @Test
    void unexpectedTenantResolutionFailureReturnsInternalErrorEnvelope() throws Exception {
        when(tenantResolver.requireActiveHost("tenant-b.localhost"))
                .thenThrow(new RuntimeException("tenant cache unavailable"));

        Authentication tenantAUser = tenantPrincipal(1L, RoleConstants.TENANT_ADMIN);

        mockMvc.perform(get(URI.create("http://tenant-b.localhost/api/v1/tenant/branding"))
                        .with(authentication(tenantAUser)))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.statusCode").value(500))
                .andExpect(jsonPath("$.errors[0].code").value("INTERNAL_ERROR"));
    }

    private static Authentication tenantPrincipal(Long tenantId, String roleAuthority) {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                5L,
                "user@example.com",
                "hash",
                tenantId,
                List.of(new SimpleGrantedAuthority(roleAuthority))
        );
        return UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities());
    }

    private static Authentication platformAdminPrincipal(Long userId) {
        DirectwerkUserPrincipal principal = new DirectwerkUserPrincipal(
                userId,
                "admin@example.com",
                "hash",
                null,
                List.of(new SimpleGrantedAuthority(RoleConstants.PLATFORM_ADMIN))
        );
        return UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities());
    }

    private static Tenant activeTenant(Long id, String slug) {
        Tenant tenant = new Tenant();
        tenant.setId(id);
        tenant.setSlug(slug);
        tenant.setName(slug);
        tenant.setStatus(TenantStatus.ACTIVE);
        return tenant;
    }
}
