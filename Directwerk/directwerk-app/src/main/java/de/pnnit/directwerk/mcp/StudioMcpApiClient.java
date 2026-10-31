package de.pnnit.directwerk.mcp;

import de.pnnit.directwerk.config.DirectwerkConfig;
import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.spec.McpSchema;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Loopback REST client used by hosted MCP tools — same surface as
 * {@code packages/mcp-studio} {@code DirectwerkClient}, forwarding the caller's
 * Bearer + tenant host from {@link McpTransportContext}.
 *
 * <p>Connects to {@code 127.0.0.1} but sets {@code Host} to the platform API
 * issuer host so {@link de.pnnit.directwerk.multitenancy.TenantRoutingHostResolver}
 * treats the call like a BFF upstream and honors {@code X-Tenant-Host}.
 */
@Component
public class StudioMcpApiClient {

    static final String CTX_AUTHORIZATION = "authorization";
    static final String CTX_TENANT_HOST = "tenantHost";

    private final RestClient.Builder restClientBuilder;
    private final Environment environment;
    private final ObjectMapper objectMapper;
    private final DirectwerkConfig directwerkConfig;

    public StudioMcpApiClient(
            RestClient.Builder restClientBuilder,
            Environment environment,
            ObjectMapper objectMapper,
            DirectwerkConfig directwerkConfig
    ) {
        this.restClientBuilder = restClientBuilder;
        this.environment = environment;
        this.objectMapper = objectMapper;
        this.directwerkConfig = directwerkConfig;
    }

    public McpSchema.CallToolResult request(
            McpTransportContext context,
            String method,
            String path,
            Object body,
            Map<String, ?> query
    ) {
        try {
            String authorization = requireContext(context, CTX_AUTHORIZATION);
            String tenantHost = requireContext(context, CTX_TENANT_HOST);
            URI uri = buildUri(path, query);
            // Prefer issuer host (BFF path + X-Tenant-Host); else tenant Host (direct traffic).
            String routingHost = platformApiHost() != null ? platformApiHost() : tenantHost;
            RestClient.RequestBodySpec spec = restClientBuilder.build()
                    .method(org.springframework.http.HttpMethod.valueOf(method))
                    .uri(uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .header("Authorization", authorization)
                    .header(HttpHeaders.HOST, routingHost)
                    .header("X-Tenant-Host", tenantHost);
            String responseBody;
            if (body != null) {
                responseBody = spec
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(String.class);
            } else {
                responseBody = spec.retrieve().body(String.class);
            }
            return ok(responseBody == null || responseBody.isBlank() ? "null" : responseBody);
        } catch (RestClientResponseException ex) {
            return error(ex.getStatusCode().value(), ex.getResponseBodyAsString());
        } catch (RuntimeException ex) {
            return error(0, ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage());
        }
    }

    public McpSchema.CallToolResult get(
            McpTransportContext context,
            String path,
            Map<String, ?> query
    ) {
        return request(context, "GET", path, null, query);
    }

    public McpSchema.CallToolResult post(
            McpTransportContext context,
            String path,
            Object body
    ) {
        return request(context, "POST", path, body == null ? Map.of() : body, null);
    }

    public McpSchema.CallToolResult put(
            McpTransportContext context,
            String path,
            Object body
    ) {
        return request(context, "PUT", path, body == null ? Map.of() : body, null);
    }

    public McpSchema.CallToolResult delete(McpTransportContext context, String path) {
        return request(context, "DELETE", path, null, null);
    }

    static Map<String, Object> args(McpSchema.CallToolRequest request) {
        Map<String, Object> arguments = request.arguments();
        return arguments == null ? Map.of() : arguments;
    }

    static Object requireArg(Map<String, Object> args, String name) {
        Object value = args.get(name);
        if (value == null) {
            throw new IllegalArgumentException("Missing required argument: " + name);
        }
        return value;
    }

    static Long longArg(Map<String, Object> args, String name) {
        Object value = requireArg(args, name);
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }

    static Long optionalLong(Map<String, Object> args, String name) {
        Object value = args.get(name);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        String text = String.valueOf(value);
        if (text.isBlank()) {
            return null;
        }
        return Long.parseLong(text);
    }

    static Map<String, Object> withoutKeys(Map<String, Object> args, String... keys) {
        Map<String, Object> copy = new LinkedHashMap<>(args);
        for (String key : keys) {
            copy.remove(key);
        }
        return copy;
    }

    static Map<String, Object> queryOf(Map<String, Object> args, String... keys) {
        Map<String, Object> query = new LinkedHashMap<>();
        for (String key : keys) {
            Object value = args.get(key);
            if (value != null && !(value instanceof String s && s.isBlank())) {
                query.put(key, value);
            }
        }
        return query;
    }

    private URI buildUri(String path, Map<String, ?> query) {
        String base = "http://127.0.0.1:" + localPort();
        UriComponentsBuilder builder = UriComponentsBuilder
                .fromUriString(base)
                .path(path.startsWith("/") ? path : "/" + path);
        if (query != null) {
            for (Map.Entry<String, ?> entry : query.entrySet()) {
                if (entry.getValue() != null) {
                    builder.queryParam(entry.getKey(), entry.getValue());
                }
            }
        }
        return builder.build(true).toUri();
    }

    private String localPort() {
        String local = environment.getProperty("local.server.port");
        if (local != null && !local.isBlank()) {
            return local;
        }
        return environment.getProperty("server.port", "8080");
    }

    private String platformApiHost() {
        String issuer = directwerkConfig.security().issuer();
        if (!StringUtils.hasText(issuer)) {
            return null;
        }
        try {
            URI uri = URI.create(issuer.trim());
            return uri.getHost() == null ? null : uri.getHost().toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String requireContext(McpTransportContext context, String key) {
        Object value = context == null ? null : context.get(key);
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalStateException("Missing MCP transport context: " + key);
        }
        return text;
    }

    private McpSchema.CallToolResult ok(String text) {
        String pretty = prettyJson(text);
        return McpSchema.CallToolResult.builder()
                .content(List.of(new McpSchema.TextContent(pretty)))
                .isError(false)
                .build();
    }

    private McpSchema.CallToolResult error(int status, String body) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("error", "Directwerk API request failed");
        payload.put("status", status);
        payload.put("body", parseMaybeJson(body));
        String text;
        try {
            text = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(payload);
        } catch (Exception ex) {
            text = Objects.toString(payload);
        }
        return McpSchema.CallToolResult.builder()
                .content(List.of(new McpSchema.TextContent(text)))
                .isError(true)
                .build();
    }

    private String prettyJson(String text) {
        try {
            JsonNode node = objectMapper.readTree(text);
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(node);
        } catch (Exception ex) {
            return text;
        }
    }

    private Object parseMaybeJson(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(body, Object.class);
        } catch (Exception ex) {
            return body;
        }
    }
}
