package de.pnnit.directwerk.modules.core.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSession;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class UmamiEventClientTest {

    @Test
    void postsEventBodyAndHeadersWhenEnabled() throws Exception {
        CapturingHttpClient httpClient = new CapturingHttpClient(200);
        UmamiEventClient client = new UmamiEventClient(
                directwerkConfig(true, "https://umami.example.test", "Directwerk-Test/1.0"),
                new ObjectMapper(),
                httpClient,
                Runnable::run
        );

        client.trackEvent(
                "123e4567-e89b-12d3-a456-426614174000",
                "alpha.example.test",
                "/episodes/episode-1",
                "episode-download",
                Map.of("source", "stream", "episodeSlug", "episode-1")
        );

        assertThat(httpClient.await()).isTrue();
        HttpRequest request = httpClient.request();
        assertThat(request.method()).isEqualTo("POST");
        assertThat(request.uri()).hasToString("https://umami.example.test/api/send");
        assertThat(request.headers().firstValue("User-Agent")).contains("Directwerk-Test/1.0");
        assertThat(request.headers().firstValue("Content-Type")).contains("application/json");
        assertThat(httpClient.body()).contains("\"type\":\"event\"");
        assertThat(httpClient.body()).contains("\"website\":\"123e4567-e89b-12d3-a456-426614174000\"");
        assertThat(httpClient.body()).contains("\"hostname\":\"alpha.example.test\"");
        assertThat(httpClient.body()).contains("\"url\":\"/episodes/episode-1\"");
        assertThat(httpClient.body()).contains("\"name\":\"episode-download\"");
        assertThat(httpClient.body()).contains("\"source\":\"stream\"");
    }

    @Test
    void doesNotSendWhenAnalyticsDisabled() throws Exception {
        CapturingHttpClient httpClient = new CapturingHttpClient(200);
        UmamiEventClient client = new UmamiEventClient(
                directwerkConfig(false, "https://umami.example.test", "Directwerk-Test/1.0"),
                new ObjectMapper(),
                httpClient,
                Runnable::run
        );

        client.trackEvent(
                "123e4567-e89b-12d3-a456-426614174000",
                "alpha.example.test",
                "/episodes/episode-1",
                "episode-download",
                Map.of()
        );

        assertThat(httpClient.await()).isFalse();
        assertThat(httpClient.request()).isNull();
    }

    @Test
    void doesNotSendWhenHostIsNotHttps() throws Exception {
        CapturingHttpClient httpClient = new CapturingHttpClient(200);
        UmamiEventClient client = new UmamiEventClient(
                directwerkConfig(true, "http://umami.example.test", "Directwerk-Test/1.0"),
                new ObjectMapper(),
                httpClient,
                Runnable::run
        );

        client.trackEvent(
                "123e4567-e89b-12d3-a456-426614174000",
                "alpha.example.test",
                "/episodes/episode-1",
                "episode-download",
                Map.of()
        );

        assertThat(httpClient.await()).isFalse();
        assertThat(httpClient.request()).isNull();
    }

    private static DirectwerkConfig directwerkConfig(boolean enabled, String umamiHostUrl, String userAgent) {
        return new DirectwerkConfig(new DirectwerkProperties(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new DirectwerkProperties.Analytics(enabled, umamiHostUrl, userAgent),
                null
        ));
    }

    private static final class CapturingHttpClient extends HttpClient {

        private final CountDownLatch latch = new CountDownLatch(1);
        private final int statusCode;
        private HttpRequest request;
        private String body;

        private CapturingHttpClient(int statusCode) {
            this.statusCode = statusCode;
        }

        boolean await() throws InterruptedException {
            return latch.await(100, TimeUnit.MILLISECONDS);
        }

        HttpRequest request() {
            return request;
        }

        String body() {
            return body;
        }

        @Override
        public <T> HttpResponse<T> send(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler
        ) throws IOException, InterruptedException {
            this.request = request;
            try {
                this.body = readBody(request);
            } catch (RuntimeException ex) {
                throw ex;
            } catch (Exception ex) {
                throw new IOException(ex);
            } finally {
                latch.countDown();
            }
            return response(request, statusCode);
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler
        ) {
            throw new UnsupportedOperationException("sendAsync is not used by UmamiEventClient");
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler,
                HttpResponse.PushPromiseHandler<T> pushPromiseHandler
        ) {
            throw new UnsupportedOperationException("sendAsync is not used by UmamiEventClient");
        }

        @Override
        public Optional<CookieHandler> cookieHandler() {
            return Optional.empty();
        }

        @Override
        public Optional<Duration> connectTimeout() {
            return Optional.empty();
        }

        @Override
        public Redirect followRedirects() {
            return Redirect.NEVER;
        }

        @Override
        public Optional<ProxySelector> proxy() {
            return Optional.empty();
        }

        @Override
        public SSLContext sslContext() {
            return null;
        }

        @Override
        public SSLParameters sslParameters() {
            return null;
        }

        @Override
        public Optional<Authenticator> authenticator() {
            return Optional.empty();
        }

        @Override
        public Version version() {
            return Version.HTTP_2;
        }

        @Override
        public Optional<Executor> executor() {
            return Optional.empty();
        }

        private static String readBody(HttpRequest request) throws Exception {
            HttpRequest.BodyPublisher publisher = request.bodyPublisher().orElseThrow();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            CountDownLatch bodyLatch = new CountDownLatch(1);
            AtomicReference<Throwable> error = new AtomicReference<>();
            publisher.subscribe(new Flow.Subscriber<>() {
                @Override
                public void onSubscribe(Flow.Subscription subscription) {
                    subscription.request(Long.MAX_VALUE);
                }

                @Override
                public void onNext(ByteBuffer item) {
                    byte[] bytes = new byte[item.remaining()];
                    item.get(bytes);
                    output.writeBytes(bytes);
                }

                @Override
                public void onError(Throwable throwable) {
                    error.set(throwable);
                    bodyLatch.countDown();
                }

                @Override
                public void onComplete() {
                    bodyLatch.countDown();
                }
            });
            if (!bodyLatch.await(100, TimeUnit.MILLISECONDS)) {
                throw new IOException("Timed out reading request body");
            }
            if (error.get() != null) {
                throw new IOException(error.get());
            }
            return output.toString(StandardCharsets.UTF_8);
        }

        private static <T> HttpResponse<T> response(HttpRequest request, int statusCode) {
            return new HttpResponse<>() {
                @Override
                public int statusCode() {
                    return statusCode;
                }

                @Override
                public HttpRequest request() {
                    return request;
                }

                @Override
                public Optional<HttpResponse<T>> previousResponse() {
                    return Optional.empty();
                }

                @Override
                public HttpHeaders headers() {
                    return HttpHeaders.of(Map.of(), (name, value) -> true);
                }

                @Override
                public T body() {
                    return null;
                }

                @Override
                public Optional<SSLSession> sslSession() {
                    return Optional.empty();
                }

                @Override
                public URI uri() {
                    return request.uri();
                }

                @Override
                public Version version() {
                    return Version.HTTP_2;
                }
            };
        }
    }
}
