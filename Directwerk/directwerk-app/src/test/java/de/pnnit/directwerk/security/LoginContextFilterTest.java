package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.multitenancy.TenantRoutingHostResolver;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

class LoginContextFilterTest {

    @AfterEach
    void clearLoginContext() {
        LoginContext.clear();
    }

    @Test
    void usesPlatformAdminLoginForPlatformClientOnPlatformApiHost() throws Exception {
        LoginContextFilter filter = buildFilter("directwerk-platform-admin", "https://api.directwerk.org");

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/oauth2/token");
        when(request.getParameter("client_id")).thenReturn("directwerk-platform-admin");
        when(request.getServerName()).thenReturn("api.directwerk.org");

        AtomicBoolean platformAdminLogin = new AtomicBoolean(false);
        FilterChain chain = (req, res) -> platformAdminLogin.set(LoginContext.isPlatformAdminLogin());

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(platformAdminLogin).isTrue();
    }

    @Test
    void usesTenantLoginWhenTenantHostHeaderPresentEvenWithPlatformClient() throws Exception {
        LoginContextFilter filter = buildFilter("directwerk-platform-admin", "https://api.directwerk.org");

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/oauth2/token");
        when(request.getParameter("client_id")).thenReturn("directwerk-platform-admin");
        when(request.getServerName()).thenReturn("api.directwerk.org");
        when(request.getHeader("X-Tenant-Host")).thenReturn("lucanerlich.directwerk.org");

        AtomicBoolean platformAdminLogin = new AtomicBoolean(true);
        FilterChain chain = (req, res) -> platformAdminLogin.set(LoginContext.isPlatformAdminLogin());

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(platformAdminLogin).isFalse();
    }

    private static LoginContextFilter buildFilter(String platformClientId, String issuer) {
        DirectwerkConfig config = mock(DirectwerkConfig.class);
        DirectwerkProperties.Security security = mock(DirectwerkProperties.Security.class);
        when(config.security()).thenReturn(security);
        when(security.platformClientId()).thenReturn(platformClientId);
        when(security.issuer()).thenReturn(issuer);
        return new LoginContextFilter(config, new TenantRoutingHostResolver(config));
    }
}
