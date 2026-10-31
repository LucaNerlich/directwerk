package de.pnnit.directwerk.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import io.modelcontextprotocol.common.McpTransportContext;
import java.net.URI;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.ClientHttpRequest;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.http.client.MockClientHttpResponse;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

class StudioMcpApiClientTest {

    private final AtomicReference<HttpHeaders> capturedHeaders = new AtomicReference<>();
    private final AtomicReference<URI> capturedUri = new AtomicReference<>();
    private StudioMcpApiClient client;

    @BeforeEach
    void setUp() {
        DirectwerkConfig config = mock(DirectwerkConfig.class);
        DirectwerkProperties.Security security = mock(DirectwerkProperties.Security.class);
        when(config.security()).thenReturn(security);
        when(security.issuer()).thenReturn("https://api.directwerk.org");

        Environment environment = new MockEnvironment().withProperty("server.port", "8080");
        ClientHttpRequestFactory factory = (uri, httpMethod) -> {
            capturedUri.set(uri);
            ClientHttpRequest request = new org.springframework.mock.http.client.MockClientHttpRequest(httpMethod, uri) {
                @Override
                protected ClientHttpResponse executeInternal() {
                    capturedHeaders.set(getHeaders());
                    return new MockClientHttpResponse(
                            "{\"data\":[]}".getBytes(),
                            HttpStatus.OK
                    );
                }
            };
            return request;
        };

        client = new StudioMcpApiClient(
                RestClient.builder().requestFactory(factory),
                environment,
                new ObjectMapper(),
                config
        );
    }

    @Test
    void loopbackSetsIssuerHostSoTenantHeaderIsHonored() {
        McpTransportContext ctx = McpTransportContext.create(Map.of(
                StudioMcpApiClient.CTX_AUTHORIZATION, "Bearer dwk_test_secret",
                StudioMcpApiClient.CTX_TENANT_HOST, "show.example.com"
        ));

        var result = client.get(ctx, "/api/v1/articles", Map.of());

        assertThat(result.isError()).isFalse();
        assertThat(capturedUri.get().getHost()).isEqualTo("127.0.0.1");
        assertThat(capturedHeaders.get().getFirst(HttpHeaders.HOST)).isEqualTo("api.directwerk.org");
        assertThat(capturedHeaders.get().getFirst("X-Tenant-Host")).isEqualTo("show.example.com");
        assertThat(capturedHeaders.get().getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo("Bearer dwk_test_secret");
    }
}
