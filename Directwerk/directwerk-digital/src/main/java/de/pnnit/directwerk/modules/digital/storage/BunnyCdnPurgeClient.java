package de.pnnit.directwerk.modules.digital.storage;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.digital.api.CdnPurgeClient;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Bunny Core Purge URL client. No-ops when purge is not configured or provider is not bunny.
 * Never accepts client-supplied URLs — callers must pass application-built CDN URLs only.
 */
@Component
@ConditionalOnProperty(prefix = "directwerk.storage", name = "enabled", havingValue = "true")
public class BunnyCdnPurgeClient implements CdnPurgeClient {

    private static final Logger log = LoggerFactory.getLogger(BunnyCdnPurgeClient.class);
    private static final String DEFAULT_API_BASE = "https://api.bunny.net";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    private final DirectwerkConfig directwerkConfig;
    private final HttpClient httpClient;
    private final S3PublicUrlBuilder publicUrlBuilder;

    @Autowired
    public BunnyCdnPurgeClient(
            DirectwerkConfig directwerkConfig,
            S3PublicUrlBuilder publicUrlBuilder
    ) {
        this(directwerkConfig, publicUrlBuilder, HttpClient.newBuilder()
                .connectTimeout(REQUEST_TIMEOUT)
                .build());
    }

    BunnyCdnPurgeClient(
            DirectwerkConfig directwerkConfig,
            S3PublicUrlBuilder publicUrlBuilder,
            HttpClient httpClient
    ) {
        this.directwerkConfig = directwerkConfig;
        this.publicUrlBuilder = publicUrlBuilder;
        this.httpClient = httpClient;
    }

    @Override
    public void purgeUrl(URL cdnUrl) {
        if (cdnUrl == null) {
            return;
        }
        DirectwerkProperties.Storage storage = directwerkConfig.storage();
        if (storage == null) {
            return;
        }
        String apiKey = storage.cdnPurgeApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            log.debug("CDN purge skipped — directwerk.storage.cdn-purge-api-key is not set");
            return;
        }
        if (storage.provider() == null || !"bunny".equalsIgnoreCase(storage.provider())) {
            log.debug("CDN purge skipped — provider is not bunny ({})", storage.provider());
            return;
        }
        if (!isAllowedCdnUrl(cdnUrl)) {
            log.warn("CDN purge skipped — URL host does not match configured public or private CDN base");
            return;
        }

        String apiBase = storage.cdnPurgeApiBaseUrl();
        if (apiBase == null || apiBase.isBlank()) {
            apiBase = DEFAULT_API_BASE;
        }
        apiBase = trimTrailingSlash(apiBase);

        URI apiBaseUri;
        try {
            apiBaseUri = URI.create(apiBase);
            if (!apiBaseUri.isAbsolute()) {
                log.error("CDN purge API base URL is not absolute: {}", apiBase);
                return;
            }
            if (!"https".equalsIgnoreCase(apiBaseUri.getScheme())) {
                log.error("CDN purge API base URL must use HTTPS scheme, got: {}", apiBaseUri.getScheme());
                return;
            }
            if (apiBaseUri.getHost() == null || apiBaseUri.getHost().isBlank()) {
                log.error("CDN purge API base URL must have a non-blank host");
                return;
            }
        } catch (IllegalArgumentException ex) {
            log.error("CDN purge API base URL is invalid: {}", apiBase, ex);
            return;
        }

        String encodedUrl = URLEncoder.encode(cdnUrl.toString(), StandardCharsets.UTF_8);
        URI purgeUri = URI.create(apiBase + "/purge?url=" + encodedUrl + "&async=true");

        HttpRequest request = HttpRequest.newBuilder(purgeUri)
                .timeout(REQUEST_TIMEOUT)
                .header("AccessKey", apiKey)
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();

        try {
            HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            int status = response.statusCode();
            if (status < 200 || status >= 300) {
                log.warn("CDN purge returned HTTP {} for asset URL host {}", status, cdnUrl.getHost());
            }
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.warn("CDN purge request failed for asset URL host {}: {}", cdnUrl.getHost(), ex.toString());
        }
    }

    private boolean isAllowedCdnUrl(URL cdnUrl) {
        if (!"https".equalsIgnoreCase(cdnUrl.getProtocol())) {
            return false;
        }
        String host = cdnUrl.getHost();
        if (host == null || host.isBlank()) {
            return false;
        }
        if (hostMatches(publicUrlBuilder.publicCdnBaseUrl(), host)) {
            return true;
        }
        DirectwerkProperties.Storage storage = directwerkConfig.storage();
        return storage != null && hostMatches(storage.privateCdnBaseUrl(), host);
    }

    private static boolean hostMatches(String configuredBaseUrl, String host) {
        if (configuredBaseUrl == null || configuredBaseUrl.isBlank()) {
            return false;
        }
        try {
            URI configured = URI.create(configuredBaseUrl.trim());
            return configured.getHost() != null && configured.getHost().equalsIgnoreCase(host);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static String trimTrailingSlash(String value) {
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }
}
