package de.pnnit.directwerk.modules.core.analytics;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@Slf4j
public class UmamiEventClient {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);

    private final DirectwerkConfig directwerkConfig;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final Executor executor;
    private final AutoCloseable executorCloseable;

    @Autowired
    public UmamiEventClient(DirectwerkConfig directwerkConfig, ObjectMapper objectMapper) {
        ExecutorService executorService = Executors.newVirtualThreadPerTaskExecutor();
        this.directwerkConfig = directwerkConfig;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(REQUEST_TIMEOUT)
                .build();
        this.executor = executorService;
        this.executorCloseable = executorService;
    }

    UmamiEventClient(
            DirectwerkConfig directwerkConfig,
            ObjectMapper objectMapper,
            HttpClient httpClient,
            Executor executor
    ) {
        this.directwerkConfig = directwerkConfig;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
        this.executor = executor;
        this.executorCloseable = null;
    }

    public void trackEvent(
            String websiteId,
            String hostname,
            String url,
            String eventName,
            Map<String, Object> data
    ) {
        trackEvent(null, websiteId, hostname, url, eventName, data);
    }

    public void trackEvent(
            String hostUrl,
            String websiteId,
            String hostname,
            String url,
            String eventName,
            Map<String, Object> data
    ) {
        if (isBlank(websiteId)) {
            return;
        }
        Optional<URI> sendUri = sendUri(hostUrl);
        if (sendUri.isEmpty()) {
            return;
        }

        try {
            executor.execute(() -> sendEvent(sendUri.get(), websiteId, hostname, url, eventName, data));
        } catch (RuntimeException ex) {
            log.debug("Umami event task could not be scheduled: {}", ex.toString());
        }
    }

    @PreDestroy
    void closeExecutor() {
        if (executorCloseable != null) {
            try {
                executorCloseable.close();
            } catch (Exception ex) {
                log.debug("Failed to close Umami event executor: {}", ex.toString());
            }
        }
        try {
            httpClient.close();
        } catch (Exception ex) {
            log.debug("Failed to close Umami HTTP client: {}", ex.toString());
        }
    }

    private void sendEvent(
            URI sendUri,
            String websiteId,
            String hostname,
            String url,
            String eventName,
            Map<String, Object> data
    ) {
        try {
            String body = objectMapper.writeValueAsString(new UmamiRequest(
                    "event",
                    new UmamiPayload(
                            websiteId,
                            hostname,
                            url,
                            eventName,
                            data == null ? Map.of() : Map.copyOf(data)
                    )
            ));
            String userAgent = directwerkConfig.analytics().userAgent();
            HttpRequest request = HttpRequest.newBuilder(sendUri)
                    .timeout(REQUEST_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("User-Agent", isBlank(userAgent) ? "Directwerk/1.0" : userAgent)
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.debug("Umami event returned HTTP {} for event {}", response.statusCode(), eventName);
            }
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.debug("Umami event delivery failed for event {}: {}", eventName, ex.toString());
        }
    }

    private Optional<URI> sendUri(String hostUrlOverride) {
        String configuredHostUrl = hostUrlOverride;
        if (isBlank(configuredHostUrl)) {
            if (!directwerkConfig.isAnalyticsEnabled()) {
                return Optional.empty();
            }
            DirectwerkProperties.Analytics analytics = directwerkConfig.analytics();
            configuredHostUrl = analytics == null ? null : analytics.umamiHostUrl();
        }
        if (isBlank(configuredHostUrl)) {
            return Optional.empty();
        }
        try {
            URI baseUri = URI.create(trimTrailingSlash(configuredHostUrl.trim()));
            if (!isAllowedBaseUri(baseUri)) {
                log.error("Umami host URL must be an absolute HTTPS URL with a host");
                return Optional.empty();
            }
            return Optional.of(URI.create(baseUri + "/api/send"));
        } catch (IllegalArgumentException ex) {
            log.error("Umami host URL is invalid", ex);
            return Optional.empty();
        }
    }

    private static boolean isAllowedBaseUri(URI uri) {
        return uri.isAbsolute()
                && "https".equalsIgnoreCase(uri.getScheme())
                && uri.getHost() != null
                && !uri.getHost().isBlank()
                && uri.getUserInfo() == null
                && uri.getRawQuery() == null
                && uri.getRawFragment() == null;
    }

    private static String trimTrailingSlash(String value) {
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record UmamiRequest(String type, UmamiPayload payload) {
    }

    private record UmamiPayload(
            String website,
            String hostname,
            String url,
            String name,
            Map<String, Object> data
    ) {
    }
}
