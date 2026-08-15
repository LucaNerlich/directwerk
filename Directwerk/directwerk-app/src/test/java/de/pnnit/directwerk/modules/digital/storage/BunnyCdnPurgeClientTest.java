package de.pnnit.directwerk.modules.digital.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BunnyCdnPurgeClientTest {

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<Void> httpResponse;

    @Test
    void purgePostsToBunnyWithAccessKey() throws Exception {
        when(directwerkConfig.storage()).thenReturn(storageProps("bunny", "secret-key"));
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        BunnyCdnPurgeClient client = new BunnyCdnPurgeClient(
                directwerkConfig,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                httpClient
        );
        String deletedAssetUrl = "https://cdn.example.test/alpha/public/images/a.jpg";
        client.purgeUrl(URI.create(deletedAssetUrl).toURL());

        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(requestCaptor.capture(), any(HttpResponse.BodyHandler.class));
        HttpRequest request = requestCaptor.getValue();
        assertThat(request.method()).isEqualTo("POST");

        String queryString = request.uri().getQuery();
        Map<String, String> queryParams = Arrays.stream(queryString.split("&"))
                .map(param -> param.split("=", 2))
                .collect(Collectors.toMap(
                        parts -> parts[0],
                        parts -> URLDecoder.decode(parts[1], StandardCharsets.UTF_8)
                ));

        assertThat(queryParams.get("url")).isEqualTo(deletedAssetUrl);
        assertThat(queryParams.get("async")).isEqualTo("true");
        assertThat(request.headers().firstValue("AccessKey")).contains("secret-key");
    }

    @Test
    void skipsWhenApiKeyMissing() throws Exception {
        when(directwerkConfig.storage()).thenReturn(storageProps("bunny", null));

        BunnyCdnPurgeClient client = new BunnyCdnPurgeClient(
                directwerkConfig,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                httpClient
        );
        client.purgeUrl(URI.create("https://cdn.example.test/alpha/public/images/a.jpg").toURL());

        verify(httpClient, never()).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void skipsWhenHostDoesNotMatchConfiguredCdn() throws Exception {
        when(directwerkConfig.storage()).thenReturn(storageProps("bunny", "secret-key"));

        BunnyCdnPurgeClient client = new BunnyCdnPurgeClient(
                directwerkConfig,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                httpClient
        );
        client.purgeUrl(URI.create("https://evil.example/steal").toURL());

        verify(httpClient, never()).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void httpErrorDoesNotThrow() throws Exception {
        when(directwerkConfig.storage()).thenReturn(storageProps("bunny", "secret-key"));
        when(httpResponse.statusCode()).thenReturn(500);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        BunnyCdnPurgeClient client = new BunnyCdnPurgeClient(
                directwerkConfig,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                httpClient
        );
        client.purgeUrl(URI.create("https://cdn.example.test/alpha/public/images/a.jpg").toURL());

        verify(httpClient).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void purgesPrivateCdnHost() throws Exception {
        when(directwerkConfig.storage()).thenReturn(storageProps(
                "bunny",
                "secret-key",
                "https://private.example.test"
        ));
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        BunnyCdnPurgeClient client = new BunnyCdnPurgeClient(
                directwerkConfig,
                new S3PublicUrlBuilder("https://cdn.example.test"),
                httpClient
        );
        client.purgeUrl(URI.create("https://private.example.test/alpha/private/rss/feed-42.xml").toURL());

        verify(httpClient).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    private static DirectwerkProperties.Storage storageProps(String provider, String purgeKey) {
        return storageProps(provider, purgeKey, null);
    }

    private static DirectwerkProperties.Storage storageProps(String provider, String purgeKey, String privateCdn) {
        return new DirectwerkProperties.Storage(
                true,
                provider,
                "de",
                "directwerk-dev",
                null,
                "https://de-s3.storage.bunnycdn.com",
                true,
                "zone",
                "password",
                "https://cdn.example.test",
                privateCdn,
                null,
                Duration.ofMinutes(15),
                Duration.ofHours(1),
                Duration.ofHours(24),
                24,
                3600000L,
                purgeKey,
                "https://api.bunny.net"
        );
    }
}
