package de.pnnit.directwerk.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TenantRoutingHostResolverTest {

    private TenantRoutingHostResolver resolver;

    @BeforeEach
    void setUp() {
        DirectwerkConfig config = mock(DirectwerkConfig.class);
        DirectwerkProperties.Security security = mock(DirectwerkProperties.Security.class);
        when(config.security()).thenReturn(security);
        when(security.issuer()).thenReturn("https://api.directwerk.org");
        resolver = new TenantRoutingHostResolver(config);
    }

    @Test
    void keepsVerifiedTenantDomainRequestsUnchanged() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getServerName()).thenReturn("lucanerlich.directwerk.org");

        assertThat(resolver.resolve(request)).isEqualTo("lucanerlich.directwerk.org");
    }

    @Test
    void resolvesTenantFromForwardedHostOnPlatformApiHostname() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getServerName()).thenReturn("api.directwerk.org");
        when(request.getHeader("X-Forwarded-Host")).thenReturn("lucanerlich.directwerk.org");

        assertThat(resolver.resolve(request)).isEqualTo("lucanerlich.directwerk.org");
    }

    @Test
    void resolvesTenantFromTenantHostHeaderWhenPlatformApiHostname() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getServerName()).thenReturn("api.directwerk.org");
        when(request.getHeader("X-Forwarded-Host")).thenReturn(null);
        when(request.getHeader("Forwarded")).thenReturn(null);
        when(request.getHeader("X-Tenant-Host")).thenReturn("lucanerlich.directwerk.org");

        assertThat(resolver.resolve(request)).isEqualTo("lucanerlich.directwerk.org");
    }

    @Test
    void prefersTenantHostHeaderWhenReverseProxyOverwritesForwardedHost() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getServerName()).thenReturn("api.directwerk.org");
        when(request.getHeader("X-Forwarded-Host")).thenReturn("api.directwerk.org");
        when(request.getHeader("Forwarded")).thenReturn(null);
        when(request.getHeader("X-Tenant-Host")).thenReturn("lucanerlich.directwerk.org");

        assertThat(resolver.resolve(request)).isEqualTo("lucanerlich.directwerk.org");
    }

    @Test
    void parseForwardedHeaderExtractsHostParameter() {
        assertThat(TenantRoutingHostResolver.parseForwardedHeader(
                "for=127.0.0.1;host=lucanerlich.directwerk.org;proto=https"
        )).contains("lucanerlich.directwerk.org");
    }

    @Test
    void parseForwardedHostChainIgnoresLeadingPlatformHost() {
        assertThat(TenantRoutingHostResolver.parseForwardedHostChain(
                "api.directwerk.org, lucanerlich.directwerk.org",
                "api.directwerk.org"
        )).contains("lucanerlich.directwerk.org");
    }

    @Test
    void resolvesExplicitTenantHostWhenIssuerMetadataMissing() {
        DirectwerkConfig config = mock(DirectwerkConfig.class);
        DirectwerkProperties.Security security = mock(DirectwerkProperties.Security.class);
        when(config.security()).thenReturn(security);
        when(security.issuer()).thenReturn("");
        TenantRoutingHostResolver resolver = new TenantRoutingHostResolver(config);

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getServerName()).thenReturn("api.directwerk.org");
        when(request.getHeader("X-Tenant-Host")).thenReturn("lucanerlich.directwerk.org");

        assertThat(resolver.resolve(request)).isEqualTo("lucanerlich.directwerk.org");
    }
}
