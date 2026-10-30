package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.apikey.TenantApiKeyScopes;
import de.pnnit.directwerk.modules.core.service.TenantApiKeyService;
import de.pnnit.directwerk.modules.core.service.TenantApiKeyService.AuthenticatedApiKey;
import jakarta.servlet.FilterChain;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class TenantApiKeyAuthenticationFilterTest {

    private final TenantApiKeyService tenantApiKeyService = mock(TenantApiKeyService.class);
    private final ApiAuthenticationEntryPoint entryPoint = mock(ApiAuthenticationEntryPoint.class);
    private final TenantApiKeyAuthenticationFilter filter =
            new TenantApiKeyAuthenticationFilter(tenantApiKeyService, entryPoint);

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void writeScopeGrantsEditorAndContentWriteAuthorityNotTenantAdmin() {
        var authorities = TenantApiKeyAuthenticationFilter.authoritiesFor(
                Set.of(TenantApiKeyScopes.CONTENT_WRITE)
        );
        assertThat(authorities)
                .extracting(SimpleGrantedAuthority::getAuthority)
                .containsExactlyInAnyOrder(
                        RoleConstants.EDITOR,
                        TenantApiKeyScopes.CONTENT_WRITE_AUTHORITY
                );
        assertThat(authorities)
                .extracting(SimpleGrantedAuthority::getAuthority)
                .doesNotContain(RoleConstants.TENANT_ADMIN);
    }

    @Test
    void readScopeGrantsEditorOnly() {
        assertThat(TenantApiKeyAuthenticationFilter.authoritiesFor(Set.of(TenantApiKeyScopes.CONTENT_READ)))
                .extracting(SimpleGrantedAuthority::getAuthority)
                .containsExactly(RoleConstants.EDITOR);
    }

    @Test
    void authenticatesValidOpaqueKey() throws Exception {
        when(tenantApiKeyService.authenticate("dwk_abcd_secret")).thenReturn(Optional.of(
                new AuthenticatedApiKey(9L, 1L, 5L, "admin@example.com", Set.of(TenantApiKeyScopes.CONTENT_WRITE))
        ));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer dwk_abcd_secret");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isInstanceOf(TenantApiKeyAuthenticationToken.class);
        assertThat(authentication.getAuthorities())
                .extracting(a -> a.getAuthority())
                .doesNotContain(RoleConstants.TENANT_ADMIN);
        verify(chain).doFilter(request, response);
        verify(entryPoint, never()).commence(any(), any(), any());
    }

    @Test
    void invalidOpaqueKeyDoesNotFallThroughToJwt() throws Exception {
        when(tenantApiKeyService.authenticate("dwk_bad_secret")).thenReturn(Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer dwk_bad_secret");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain, never()).doFilter(any(), any());
        verify(entryPoint).commence(eq(request), eq(response), any());
    }
}
