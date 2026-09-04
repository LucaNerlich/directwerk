package de.pnnit.directwerk.modules.core.analytics;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.util.UmamiHostUrlValidator;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
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
import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@Slf4j
public class UmamiEventClient {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);
    static final int RESPONSE_PREFIX_BYTES = 8 * 1024;

    /**
     * Collector {@code User-Agent} for {@code POST /api/send}.
     *
     * <p>Umami runs {@code isbot} on the collector request and silently drops bot-classified
     * events with HTTP 200 {@code {"beep":"boop"}}, so a custom token such as
     * {@code Directwerk/1.0} never reaches the dashboard even though delivery "succeeds".
     * Podcatcher UAs must not be forwarded either (they are bot-classified too) — the real
     * client stays in the event {@code data} ({@code clientUserAgent}) while this stable
     * browser UA satisfies the bot filter.
     */
    static final String COLLECTOR_USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

    private final DirectwerkConfig directwerkConfig;
    private final ObjectMapper objectMapper;
    private final EventSender eventSender;
    private final Executor executor;
    private final AutoCloseable executorCloseable;

    @Autowired
    public UmamiEventClient(DirectwerkConfig directwerkConfig, ObjectMapper objectMapper) {
        ExecutorService executorService = Executors.newVirtualThreadPerTaskExecutor();
        this.directwerkConfig = directwerkConfig;
        this.objectMapper = objectMapper;
        this.eventSender = new PinnedEventSender();
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
        this.eventSender = new JdkEventSender(httpClient);
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
        trackEvent(hostUrl, websiteId, hostname, url, eventName, data, null);
    }

    public void trackEvent(
            String hostUrl,
            String websiteId,
            String hostname,
            String url,
            String eventName,
            Map<String, Object> data,
            String clientIp
    ) {
        if (isBlank(websiteId)) {
            return;
        }
        Optional<URI> sendUri = sendUri(hostUrl);
        if (sendUri.isEmpty()) {
            return;
        }

        try {
            executor.execute(() -> sendEvent(
                    sendUri.get(), websiteId, hostname, url, eventName, data, clientIp));
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
    }

    private void sendEvent(
            URI sendUri,
            String websiteId,
            String hostname,
            String url,
            String eventName,
            Map<String, Object> data,
            String clientIp
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
            String userAgent = resolveCollectorUserAgent();
            UmamiDelivery delivery = eventSender.send(sendUri, body, userAgent, clientIp);
            int statusCode = delivery.statusCode();
            if (statusCode < 200 || statusCode >= 300) {
                log.warn("Umami event returned HTTP {} for event {}", statusCode, eventName);
            } else if (delivery.isBotDrop()) {
                log.warn(
                        "Umami silently dropped event {} as bot traffic (isbot matched collector User-Agent '{}'). "
                                + "Check DIRECTWERK_ANALYTICS_USER_AGENT — it must look like a real browser.",
                        eventName,
                        userAgent);
            } else {
                log.debug("Umami event {} delivered to {}", eventName, sendUri.getHost());
            }
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.warn("Umami event delivery failed for event {}: {}", eventName, ex.toString());
        }
    }

    /**
     * Returns the configured collector UA only when it looks like a real browser; any custom
     * token ({@code Directwerk/1.0}, podcatcher UAs, empty) is replaced with the safe default
     * so existing deployments recover without an env change.
     */
    String resolveCollectorUserAgent() {
        String configured = directwerkConfig.analytics() == null
                ? null
                : directwerkConfig.analytics().userAgent();
        if (!isBlank(configured) && configured.toLowerCase(java.util.Locale.ROOT).contains("mozilla")) {
            return configured.trim();
        }
        if (!isBlank(configured)) {
            log.debug(
                    "Ignoring bot-classified analytics User-Agent '{}'; using browser collector UA instead",
                    configured);
        }
        return COLLECTOR_USER_AGENT;
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
                && uri.getRawFragment() == null
                && (uri.getPath() == null || uri.getPath().isEmpty() || "/".equals(uri.getPath()));
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

    @FunctionalInterface
    private interface EventSender {

        UmamiDelivery send(URI uri, String body, String userAgent, String clientIp)
                throws IOException, InterruptedException;
    }

    record UmamiDelivery(int statusCode, String responseBody) {

        boolean isBotDrop() {
            return responseBody != null && responseBody.contains("beep");
        }
    }

    record JdkEventSender(HttpClient httpClient) implements EventSender {

        @Override
        public UmamiDelivery send(URI uri, String body, String userAgent, String clientIp)
                throws IOException, InterruptedException {
            HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                    .timeout(REQUEST_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("User-Agent", userAgent)
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
            if (!isBlank(clientIp)) {
                builder.header("X-Forwarded-For", clientIp.trim());
            }
            HttpRequest request = builder.build();
            HttpResponse<InputStream> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream responseBody = response.body()) {
                return new UmamiDelivery(response.statusCode(), readResponsePrefix(responseBody));
            }
        }
    }

    /** Resolves and pins the destination inside the analytics executor before connecting. */
    static final class PinnedEventSender implements EventSender {

        @Override
        public UmamiDelivery send(URI uri, String body, String userAgent, String clientIp) throws IOException {
            String expectedHost = uri.getHost();
            String expectedDnsHost = stripIpv6Brackets(expectedHost);
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
                            .setConnectTimeout(Timeout.ofMilliseconds(REQUEST_TIMEOUT.toMillis()))
                            .build())
                    .build();
            try (CloseableHttpClient client = HttpClients.custom()
                    .setConnectionManager(connectionManager)
                    .disableAutomaticRetries()
                    .disableRedirectHandling()
                    .build()) {
                HttpPost request = new HttpPost(uri);
                request.setHeader("Accept", "application/json");
                request.setHeader("User-Agent", userAgent);
                if (!isBlank(clientIp)) {
                    request.setHeader("X-Forwarded-For", clientIp.trim());
                }
                request.setEntity(new StringEntity(body, ContentType.APPLICATION_JSON));
                request.setConfig(RequestConfig.custom()
                        .setResponseTimeout(Timeout.ofMilliseconds(REQUEST_TIMEOUT.toMillis()))
                        .build());
                // The URI keeps the original hostname, so the default TLS verifier checks it
                // while the custom resolver connects only to the already validated addresses.
                return client.execute(request, response -> toDelivery(
                        response.getCode(),
                        response.getEntity() == null ? null : response.getEntity().getContent()));
            }
        }

        static UmamiDelivery toDelivery(int statusCode, InputStream responseBody) throws IOException {
            try (responseBody) {
                return new UmamiDelivery(statusCode, readResponsePrefix(responseBody));
            }
        }

        private static String stripIpv6Brackets(String host) {
            if (host.startsWith("[") && host.endsWith("]")) {
                return host.substring(1, host.length() - 1);
            }
            return host;
        }
    }

    private static String readResponsePrefix(InputStream responseBody) throws IOException {
        if (responseBody == null) {
            return null;
        }
        return new String(responseBody.readNBytes(RESPONSE_PREFIX_BYTES), StandardCharsets.UTF_8);
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
