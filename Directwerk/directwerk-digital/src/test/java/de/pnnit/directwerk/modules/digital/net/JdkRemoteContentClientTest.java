package de.pnnit.directwerk.modules.digital.net;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class JdkRemoteContentClientTest {

    @Test
    void resolvesRelativeRedirectLocations() throws Exception {
        List<HttpRequest> requests = new ArrayList<>();
        HttpClient httpClient = stubClient(requests, List.of(
                response(302, Map.of("Location", List.of("../next.xml"))),
                response(200, Map.of("Content-Type", List.of("application/rss+xml")))
        ));

        try (RemoteContentClient.RemoteResponse response = new JdkRemoteContentClient(httpClient).get(
                URI.create("https://1.1.1.1/start/path/feed.xml"),
                Duration.ofSeconds(5)
        )) {
            assertThat(response.finalUri()).isEqualTo(URI.create("https://1.1.1.1/start/next.xml"));
        }
        assertThat(requests).extracting(HttpRequest::uri).containsExactly(
                URI.create("https://1.1.1.1/start/path/feed.xml"),
                URI.create("https://1.1.1.1/start/next.xml")
        );
    }

    @Test
    void revalidatesEveryRedirectLocation() throws Exception {
        HttpClient httpClient = stubClient(new ArrayList<>(), List.of(
                response(302, Map.of("Location", List.of("http://127.0.0.1/private")))
        ));

        assertThatThrownBy(() -> new JdkRemoteContentClient(httpClient).get(
                URI.create("https://1.1.1.1/feed.xml"),
                Duration.ofSeconds(5)
        )).isInstanceOf(UploadValidationException.class)
                .extracting("code")
                .isEqualTo("REMOTE_URL_FORBIDDEN");
    }

    @Test
    void rejectsRedirectWithoutLocation() throws Exception {
        HttpClient httpClient = stubClient(new ArrayList<>(), List.of(response(302, Map.of())));

        assertThatThrownBy(() -> new JdkRemoteContentClient(httpClient).get(
                URI.create("https://1.1.1.1/feed.xml"),
                Duration.ofSeconds(5)
        )).isInstanceOf(UploadValidationException.class)
                .hasMessageContaining("Redirect without Location");
    }

    @Test
    void rejectsMoreThanTheMaximumRedirects() throws Exception {
        List<HttpRequest> requests = new ArrayList<>();
        HttpClient httpClient = stubClient(requests, List.of(
                response(302, Map.of("Location", List.of("/hop-1"))),
                response(302, Map.of("Location", List.of("/hop-2"))),
                response(302, Map.of("Location", List.of("/hop-3"))),
                response(302, Map.of("Location", List.of("/hop-4"))),
                response(302, Map.of("Location", List.of("/hop-5")))
        ));

        assertThatThrownBy(() -> new JdkRemoteContentClient(httpClient).get(
                URI.create("https://1.1.1.1/feed.xml"),
                Duration.ofSeconds(5)
        )).isInstanceOf(UploadValidationException.class)
                .hasMessageContaining("Too many redirects");
        assertThat(requests).hasSize(5);
    }

    @Test
    void closesAStalledBodyWhenTheOverallDeadlineExpires() {
        CountDownLatch closed = new CountDownLatch(1);
        InputStream stalled = new InputStream() {
            @Override
            public int read() throws IOException {
                try {
                    closed.await();
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new IOException("interrupted", ex);
                }
                throw new IOException("closed");
            }

            @Override
            public void close() {
                closed.countDown();
            }
        };

        JdkRemoteContentClient.DeadlineInputStream body =
                new JdkRemoteContentClient.DeadlineInputStream(
                        stalled,
                        Duration.ofMillis(25).toNanos()
                );

        assertThatThrownBy(body::read)
                .isInstanceOf(HttpTimeoutException.class)
                .hasMessageContaining("timed out");
    }

    @SuppressWarnings("unchecked")
    private static HttpClient stubClient(List<HttpRequest> requests, List<HttpResponse<InputStream>> responses)
            throws IOException, InterruptedException {
        HttpClient httpClient = mock(HttpClient.class);
        AtomicInteger nextResponse = new AtomicInteger();
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenAnswer(invocation -> {
                    requests.add(invocation.getArgument(0));
                    return responses.get(nextResponse.getAndIncrement());
                });
        return httpClient;
    }

    @SuppressWarnings("unchecked")
    private static HttpResponse<InputStream> response(int status, Map<String, List<String>> headers) {
        HttpResponse<InputStream> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.headers()).thenReturn(HttpHeaders.of(headers, (name, value) -> true));
        when(response.body()).thenReturn(new ByteArrayInputStream("body".getBytes(StandardCharsets.UTF_8)));
        return response;
    }
}
