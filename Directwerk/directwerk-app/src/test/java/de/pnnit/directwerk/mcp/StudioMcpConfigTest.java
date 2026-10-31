package de.pnnit.directwerk.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.modelcontextprotocol.common.McpTransportContext;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.function.ServerRequest;

class StudioMcpConfigTest {

    @Test
    void extractsBearerAndTenantHost() {
        ServerRequest request = mock(ServerRequest.class);
        ServerRequest.Headers headers = mock(ServerRequest.Headers.class);
        when(request.headers()).thenReturn(headers);
        when(headers.firstHeader("Authorization")).thenReturn("Bearer dwk_abc_secret");
        when(headers.firstHeader("X-Tenant-Host")).thenReturn("show.example.com");
        when(headers.firstHeader("Host")).thenReturn("api.example.com");

        McpTransportContext ctx = StudioMcpConfig.extractTransportContext(request);

        assertThat(ctx.get(StudioMcpApiClient.CTX_AUTHORIZATION)).isEqualTo("Bearer dwk_abc_secret");
        assertThat(ctx.get(StudioMcpApiClient.CTX_TENANT_HOST)).isEqualTo("show.example.com");
    }

    @Test
    void fallsBackToHostWithoutPort() {
        ServerRequest request = mock(ServerRequest.class);
        ServerRequest.Headers headers = mock(ServerRequest.Headers.class);
        when(request.headers()).thenReturn(headers);
        when(headers.firstHeader("Authorization")).thenReturn("Bearer dwk_abc_secret");
        when(headers.firstHeader("X-Tenant-Host")).thenReturn(null);
        when(headers.firstHeader("Host")).thenReturn("show.example.com:443");

        McpTransportContext ctx = StudioMcpConfig.extractTransportContext(request);

        assertThat(ctx.get(StudioMcpApiClient.CTX_TENANT_HOST)).isEqualTo("show.example.com");
    }
}
