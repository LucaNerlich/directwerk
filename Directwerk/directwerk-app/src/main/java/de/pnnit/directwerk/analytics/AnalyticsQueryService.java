package de.pnnit.directwerk.analytics;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import de.pnnit.directwerk.modules.core.util.UmamiHostUrlValidator;
import de.pnnit.directwerk.modules.core.util.UmamiWebsiteIdValidator;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
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
    private final HttpClient httpClient;

    private volatile CachedToken cachedToken;

    public AnalyticsQueryService(
            DirectwerkConfig directwerkConfig,
            TenantBrandingService tenantBrandingService,
            ObjectMapper objectMapper
    ) {
        this.directwerkConfig = directwerkConfig;
        this.tenantBrandingService = tenantBrandingService;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(UPSTREAM_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
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
        if (!UmamiHostUrlValidator.isValid(apiBase)) {
            throw new AnalyticsQueryException(
                    "UMAMI_HOST_INVALID",
                    HttpStatus.BAD_GATEWAY,
                    "The configured Umami host is invalid."
            );
        }
        String base = stripTrailingSlashes(apiBase);

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
        if (!forceRelogin && cached != null && Instant.now().isBefore(cached.expiresAt())) {
            return cached.token();
        }
        String token = login(base, analytics);
        if (token == null) {
            this.cachedToken = null;
            throw new AnalyticsQueryException(
                    "UMAMI_UNAUTHORIZED",
                    HttpStatus.BAD_GATEWAY,
                    "Umami login failed."
            );
        }
        this.cachedToken = new CachedToken(token, Instant.now().plus(TOKEN_TTL));
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
            return null;
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(base + "/api/auth/login"))
                .timeout(UPSTREAM_TIMEOUT)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return null;
            }
            JsonNode payload = objectMapper.readTree(response.body());
            JsonNode token = payload.path("token");
            return token.isString() && !token.asString().isBlank() ? token.asString() : null;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception ex) {
            return null;
        }
    }

    private HttpResult get(String url, String token) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(UPSTREAM_TIMEOUT)
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return new HttpResult(response.statusCode(), response.body());
        } catch (HttpTimeoutException ex) {
            throw new AnalyticsQueryException(
                    "UMAMI_TIMEOUT",
                    HttpStatus.GATEWAY_TIMEOUT,
                    "Umami request timed out."
            );
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw unavailable();
        } catch (Exception ex) {
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
            throw new AnalyticsQueryException(
                    "UMAMI_INVALID_RESPONSE",
                    HttpStatus.BAD_GATEWAY,
                    "Umami returned an invalid response."
            );
        }
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

    private static String stripTrailingSlashes(String value) {
        String result = value;
        while (result.endsWith("/")) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }

    /** Umami summary + bucket series for one range. */
    public record StatsView(String range, long startAt, long endAt, JsonNode stats, JsonNode pageviews) {
    }

    private record CachedToken(String token, Instant expiresAt) {
    }

    private record HttpResult(int status, String body) {
        boolean isSuccessful() {
            return status >= 200 && status < 300;
        }
    }
}
