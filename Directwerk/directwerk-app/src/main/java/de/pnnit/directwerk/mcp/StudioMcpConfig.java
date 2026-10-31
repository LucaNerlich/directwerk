package de.pnnit.directwerk.mcp;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.json.McpJsonDefaults;
import io.modelcontextprotocol.json.McpJsonMapper;
import io.modelcontextprotocol.server.McpServer;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.server.transport.WebMvcStatelessServerTransport;
import io.modelcontextprotocol.spec.McpSchema;
import java.util.HashMap;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.ServerRequest;
import org.springframework.web.servlet.function.ServerResponse;

/**
 * Hosts the Studio content MCP over Streamable HTTP (stateless) at {@code /mcp}.
 * Clients authenticate with the same {@code dwk_…} Bearer + tenant Host /
 * {@code X-Tenant-Host} as the REST API.
 */
@Configuration
public class StudioMcpConfig {

    public static final String MCP_ENDPOINT = "/mcp";

    @Bean
    McpJsonMapper mcpJsonMapper() {
        return McpJsonDefaults.getMapper();
    }

    @Bean
    WebMvcStatelessServerTransport studioMcpTransport(McpJsonMapper mcpJsonMapper) {
        return WebMvcStatelessServerTransport.builder()
                .jsonMapper(mcpJsonMapper)
                .messageEndpoint(MCP_ENDPOINT)
                .contextExtractor(StudioMcpConfig::extractTransportContext)
                .build();
    }

    @Bean
    McpStatelessSyncServer studioMcpServer(
            WebMvcStatelessServerTransport studioMcpTransport,
            StudioMcpTools studioMcpTools,
            McpJsonMapper mcpJsonMapper
    ) {
        return McpServer.sync(studioMcpTransport)
                .jsonMapper(mcpJsonMapper)
                .serverInfo("directwerk-studio", "0.1.0")
                .instructions(
                        "Directwerk Studio content MCP. Authenticate with a tenant API key "
                                + "(Bearer dwk_…) and tenant Host or X-Tenant-Host. "
                                + "Local-filesystem bulk import (import_podcast_manifest) remains "
                                + "stdio-only via packages/mcp-studio."
                )
                .capabilities(McpSchema.ServerCapabilities.builder().tools(false).build())
                .tools(studioMcpTools.specifications())
                .immediateExecution(true)
                .build();
    }

    @Bean
    RouterFunction<ServerResponse> studioMcpRouterFunction(
            WebMvcStatelessServerTransport studioMcpTransport,
            McpStatelessSyncServer studioMcpServer
    ) {
        // Keep the sync server bean alive so tools stay registered for the transport handler.
        if (studioMcpServer.listTools().isEmpty()) {
            throw new IllegalStateException("Studio MCP server registered without tools");
        }
        return studioMcpTransport.getRouterFunction();
    }

    static McpTransportContext extractTransportContext(ServerRequest request) {
        Map<String, Object> values = new HashMap<>();
        String authorization = request.headers().firstHeader("Authorization");
        if (authorization != null && !authorization.isBlank()) {
            values.put(StudioMcpApiClient.CTX_AUTHORIZATION, authorization.trim());
        }
        String tenantHost = request.headers().firstHeader("X-Tenant-Host");
        if (tenantHost == null || tenantHost.isBlank()) {
            tenantHost = request.headers().firstHeader("Host");
        }
        if (tenantHost != null && !tenantHost.isBlank()) {
            // Strip optional port from Host.
            int colon = tenantHost.indexOf(':');
            values.put(
                    StudioMcpApiClient.CTX_TENANT_HOST,
                    colon > 0 ? tenantHost.substring(0, colon) : tenantHost.trim()
            );
        }
        return McpTransportContext.create(values);
    }
}
