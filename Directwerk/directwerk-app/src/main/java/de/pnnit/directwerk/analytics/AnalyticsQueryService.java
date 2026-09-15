package de.pnnit.directwerk.analytics;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.core.util.UmamiHostUrlValidator;
import de.pnnit.directwerk.modules.core.util.UmamiWebsiteIdValidator;
import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.classic.methods.HttpUriRequestBase;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.util.Timeout;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Tenant analytics read module: resolves the tenant's verified Umami target,
 * logs in server-to-server, caches the token briefly, and returns both the
 * summary and the series.
 *
 * <p>This is the one analytics read path — the API contract, OpenAPI and the
 * per-tenant host/website validation all live here instead of in a frontend
 * route. Credentials never leave the server.
 */
@Service
@Slf4j
public class AnalyticsQueryService {

    private static final Duration UPSTREAM_TIMEOUT = Duration.ofSeconds(8);
    private static final Duration TOKEN_TTL = Duration.ofMinutes(15);

    private final DirectwerkConfig directwerkConfig;
    private final TenantBrandingService tenantBrandingService;
    private final ObjectMapper objectMapper;
    private final RequestSender requestSender;

    private volatile CachedToken cachedToken;

    public AnalyticsQueryService(
            DirectwerkConfig directwerkConfig,
            TenantBrandingService tenantBrandingService,
            ObjectMapper objectMapper
    ) {
        this.directwerkConfig = directwerkConfig;
        this.tenantBrandingService = tenantBrandingService;
        this.objectMapper = objectMapper;
        this.requestSender = new PinnedRequestSender();
    }

    AnalyticsQueryService(
            DirectwerkConfig directwerkConfig,
            TenantBrandingService tenantBrandingService,
            ObjectMapper objectMapper,
            RequestSender requestSender
    ) {
        this.directwerkConfig = directwerkConfig;
        this.tenantBrandingService = tenantBrandingService;
        this.objectMapper = objectMapper;
        this.requestSender = requestSender;
    }

    public StatsView query(Long tenantId, AnalyticsRange range) {
        DirectwerkProperties.Analytics analytics = directwerkConfig.analytics();
        TenantBranding branding = tenantBrandingService.getBranding(tenantId);
        String websiteId = UmamiWebsiteIdValidator.normalize(branding.getUmamiWebsiteId());
        if (!UmamiWebsiteIdValidator.isValid(websiteId)) {
            throw new AnalyticsQueryException(
                    "ANALYTICS_NOT_CONFIGURED",
                    HttpStatus.NOT_FOUND,
                    "Umami is not configured for this tenant."
            );
        }

        String apiBase = analytics.umamiApiBaseUrl().isBlank()
                ? branding.getUmamiHostUrl()
                : analytics.umamiApiBaseUrl();
        String base = trustedBase(apiBase, analytics);

        long endAt = System.currentTimeMillis();
        long startAt = endAt - range.days() * 86_400_000L;
        String statsUrl = "%s/api/websites/%s/stats?startAt=%d&endAt=%d".formatted(
                base, encode(websiteId), startAt, endAt
        );
        String pageviewsUrl = "%s/api/websites/%s/pageviews?startAt=%d&endAt=%d&unit=%s&timezone=UTC".formatted(
                base, encode(websiteId), startAt, endAt, range.unit()
        );

        String token = resolveToken(base, false);
        HttpResult statsResponse = get(statsUrl, token);
        HttpResult pageviewsResponse = get(pageviewsUrl, token);

        if (isAuthFailure(statsResponse) || isAuthFailure(pageviewsResponse)) {
            // Token may have expired: log in once more and retry before giving up.
            token = resolveToken(base, true);
            statsResponse = get(statsUrl, token);
            pageviewsResponse = get(pageviewsUrl, token);
        }

        if (isAuthFailure(statsResponse) || isAuthFailure(pageviewsResponse)) {
            throw new AnalyticsQueryException(
                    "UMAMI_UNAUTHORIZED",
                    HttpStatus.BAD_GATEWAY,
                    "Umami rejected the credentials or website access."
            );
        }
        if (statsResponse.status() == 404 || pageviewsResponse.status() == 404) {
            throw new AnalyticsQueryException(
                    "UMAMI_WEBSITE_NOT_FOUND",
                    HttpStatus.BAD_GATEWAY,
                    "Umami website not found."
            );
        }
        if (!statsResponse.isSuccessful() || !pageviewsResponse.isSuccessful()) {
            throw new AnalyticsQueryException(
                    "UMAMI_UNAVAILABLE",
                    HttpStatus.BAD_GATEWAY,
                    "Umami returned an error."
            );
        }

        JsonNode stats = parseBody(statsResponse.body());
        JsonNode pageviews = parseBody(pageviewsResponse.body());
        if (!isStatsPayload(stats) || !pageviews.isObject()) {
            throw new AnalyticsQueryException(
                    "UMAMI_INVALID_RESPONSE",
                    HttpStatus.BAD_GATEWAY,
                    "Umami returned an invalid response."
            );
        }
        return new StatsView(range.param(), startAt, endAt, stats, pageviews);
    }

    private String resolveToken(String base, boolean forceRelogin) {
        DirectwerkProperties.Analytics analytics = directwerkConfig.analytics();
        if (!analytics.hasUmamiApiCredentials()) {
            throw new AnalyticsQueryException(
                    "UMAMI_CREDENTIALS_MISSING",
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Umami credentials are missing. Set DIRECTWERK_ANALYTICS_UMAMI_USERNAME and "
                            + "DIRECTWERK_ANALYTICS_UMAMI_PASSWORD."
            );
        }
        CachedToken cached = this.cachedToken;
        if (!forceRelogin
                && cached != null
                && cached.baseUrl().equals(base)
                && Instant.now().isBefore(cached.expiresAt())) {
            return cached.token();
        }
        if (forceRelogin) {
            this.cachedToken = null;
        }
        String token = login(base, analytics);
        this.cachedToken = new CachedToken(base, token, Instant.now().plus(TOKEN_TTL));
        return token;
    }

    private String login(String base, DirectwerkProperties.Analytics analytics) {
        String body;
        try {
            body = objectMapper.writeValueAsString(Map.of(
                    "username", analytics.umamiUsername(),
                    "password", analytics.umamiPassword()
            ));
        } catch (RuntimeException ex) {
            throw invalidResponse();
        }
        HttpResult response = send(URI.create(base + "/api/auth/login"), body, null);
        if (isAuthFailure(response)) {
            this.cachedToken = null;
            throw new AnalyticsQueryException(
                    "UMAMI_UNAUTHORIZED",
                    HttpStatus.BAD_GATEWAY,
                    "Umami rejected the configured credentials."
            );
        }
        if (!response.isSuccessful()) {
            throw unavailable();
        }
        JsonNode payload = parseBody(response.body());
        JsonNode token = payload.path("token");
        if (!token.isString() || token.asString().isBlank()) {
            throw invalidResponse();
        }
        return token.asString();
    }

    private HttpResult get(String url, String token) {
        return send(URI.create(url), null, token);
    }

    private HttpResult send(URI uri, String body, String token) {
        try {
            return requestSender.send(uri, body, token);
        } catch (InterruptedIOException ex) {
            throw new AnalyticsQueryException(
                    "UMAMI_TIMEOUT",
                    HttpStatus.GATEWAY_TIMEOUT,
                    "Umami request timed out."
            );
        } catch (IOException | RuntimeException ex) {
            throw unavailable();
        }
    }

    private static AnalyticsQueryException unavailable() {
        return new AnalyticsQueryException("UMAMI_UNAVAILABLE", HttpStatus.BAD_GATEWAY, "Umami is unavailable.");
    }

    private JsonNode parseBody(String body) {
        try {
            return objectMapper.readTree(body);
        } catch (RuntimeException ex) {
            throw invalidResponse();
        }
    }

    private static AnalyticsQueryException invalidResponse() {
        return new AnalyticsQueryException(
                "UMAMI_INVALID_RESPONSE",
                HttpStatus.BAD_GATEWAY,
                "Umami returned an invalid response."
        );
    }

    private static String trustedBase(String apiBase, DirectwerkProperties.Analytics analytics) {
        String normalized = UmamiHostUrlValidator.normalize(apiBase);
        if (!UmamiHostUrlValidator.isValid(normalized)) {
            throw invalidHost();
        }
        URI uri = URI.create(normalized);
        if (!trustedOrigins(analytics).contains(origin(uri))
                && !(effectivePort(uri) == 443 && analytics.umamiApiAllowedHosts().contains(
                        uri.getHost().toLowerCase(Locale.ROOT)))) {
            throw invalidHost();
        }
        try {
            UmamiHostUrlValidator.resolvePublicAddresses(stripIpv6Brackets(uri.getHost()));
        } catch (UnknownHostException | SecurityException ex) {
            throw invalidHost();
        }
        return normalized;
    }

    private static Set<String> trustedOrigins(DirectwerkProperties.Analytics analytics) {
        Set<String> origins = new HashSet<>();
        addConfiguredOrigin(origins, analytics.umamiHostUrl());
        addConfiguredOrigin(origins, analytics.umamiApiBaseUrl());
        return origins;
    }

    private static void addConfiguredOrigin(Set<String> origins, String configuredUrl) {
        if (UmamiHostUrlValidator.isValid(configuredUrl)) {
            origins.add(origin(URI.create(UmamiHostUrlValidator.normalize(configuredUrl))));
        }
    }

    private static String origin(URI uri) {
        return "https://%s:%d".formatted(uri.getHost().toLowerCase(Locale.ROOT), effectivePort(uri));
    }

    private static int effectivePort(URI uri) {
        return uri.getPort() == -1 ? 443 : uri.getPort();
    }

    private static AnalyticsQueryException invalidHost() {
        return new AnalyticsQueryException(
                "UMAMI_HOST_INVALID",
                HttpStatus.BAD_GATEWAY,
                "The configured Umami host is not an allowed public HTTPS destination."
        );
    }

    private static boolean isStatsPayload(JsonNode stats) {
        return stats != null
                && stats.isObject()
                && stats.path("pageviews").isNumber()
                && stats.path("visitors").isNumber()
                && stats.path("visits").isNumber()
                && stats.path("bounces").isNumber();
    }

    private static boolean isAuthFailure(HttpResult result) {
        return result.status() == 401 || result.status() == 403;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String stripIpv6Brackets(String host) {
        if (host.startsWith("[") && host.endsWith("]")) {
            return host.substring(1, host.length() - 1);
        }
        return host;
    }

    /** Umami summary + bucket series for one range. */
    public record StatsView(String range, long startAt, long endAt, JsonNode stats, JsonNode pageviews) {
    }

    private record CachedToken(String baseUrl, String token, Instant expiresAt) {
    }

    record HttpResult(int status, String body) {
        boolean isSuccessful() {
            return status >= 200 && status < 300;
        }
    }

    @FunctionalInterface
    interface RequestSender {
        HttpResult send(URI uri, String body, String token) throws IOException;
    }

    /** Resolves once, rejects private destinations, and pins that result for the TLS connection. */
    private static final class PinnedRequestSender implements RequestSender {

        @Override
        public HttpResult send(URI uri, String body, String token) throws IOException {
            String expectedDnsHost = stripIpv6Brackets(uri.getHost());
            InetAddress[] pinnedAddresses = UmamiHostUrlValidator.resolvePublicAddresses(expectedDnsHost);
            DnsResolver pinnedResolver = new DnsResolver() {
                @Override
                public InetAddress[] resolve(String host) throws UnknownHostException {
                    requireExpectedHost(host);
                    return pinnedAddresses.clone();
                }

                @Override
                public String resolveCanonicalHostname(String host) throws UnknownHostException {
                    requireExpectedHost(host);
                    return expectedDnsHost;
                }

                private void requireExpectedHost(String host) throws UnknownHostException {
                    if (!expectedDnsHost.equalsIgnoreCase(stripIpv6Brackets(host))) {
                        throw new UnknownHostException("Unexpected Umami host");
                    }
                }
            };
            var connectionManager = PoolingHttpClientConnectionManagerBuilder.create()
                    .setDnsResolver(pinnedResolver)
                    .setDefaultConnectionConfig(ConnectionConfig.custom()
                            .setConnectTimeout(Timeout.ofMilliseconds(UPSTREAM_TIMEOUT.toMillis()))
                            .build())
                    .build();
            try (CloseableHttpClient client = HttpClients.custom()
                    .setConnectionManager(connectionManager)
                    .disableAutomaticRetries()
                    .disableRedirectHandling()
                    .build()) {
                HttpUriRequestBase request;
                if (body == null) {
                    request = new HttpGet(uri);
                } else {
                    HttpPost post = new HttpPost(uri);
                    post.setEntity(new StringEntity(body, ContentType.APPLICATION_JSON));
                    request = post;
                }
                request.setHeader("Accept", "application/json");
                if (token != null) {
                    request.setHeader("Authorization", "Bearer " + token);
                }
                request.setConfig(RequestConfig.custom()
                        .setResponseTimeout(Timeout.ofMilliseconds(UPSTREAM_TIMEOUT.toMillis()))
                        .build());
                return client.execute(request, response -> new HttpResult(
                        response.getCode(),
                        response.getEntity() == null ? "" : EntityUtils.toString(response.getEntity())
                ));
            }
        }
    }
}
