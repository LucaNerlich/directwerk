package de.pnnit.directwerk.modules.digital.net;

import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.http.ClassicHttpResponse;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.util.Timeout;
import org.springframework.stereotype.Component;

/**
 * JDK {@link HttpClient} that follows a small number of redirects and re-validates each hop.
 */
@Component
public class JdkRemoteContentClient implements RemoteContentClient {

    private static final int MAX_REDIRECTS = 4;
    private static final int BODY_DEADLINE_THREADS = 4;
    private static final String USER_AGENT = "DirectwerkRssImport/1.0";
    private static final ScheduledExecutorService BODY_DEADLINE_EXECUTOR =
            Executors.newScheduledThreadPool(BODY_DEADLINE_THREADS, runnable -> {
                Thread thread = new Thread(runnable, "remote-content-deadline");
                thread.setDaemon(true);
                return thread;
            });

    private final ResponseSender responseSender;

    public JdkRemoteContentClient() {
        this(new PinnedResponseSender());
    }

    JdkRemoteContentClient(HttpClient httpClient) {
        this(new JdkResponseSender(httpClient));
    }

    private JdkRemoteContentClient(ResponseSender responseSender) {
        this.responseSender = responseSender;
    }

    /**
     * Downloads a public HTTP(S) resource and follows validated redirects within the request
     * timeout ({@code timeout}, or 15 minutes if {@code null}).
     */
    @Override
    public RemoteResponse get(URI uri, Duration timeout) throws IOException, InterruptedException {
        URI current = RemoteUrlValidator.requirePublicHttpUrl(uri);
        Duration requestTimeout = timeout == null ? Duration.ofMinutes(15) : timeout;
        long deadline = System.nanoTime() + requestTimeout.toNanos();
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            long remainingNanos = deadline - System.nanoTime();
            if (remainingNanos <= 0) {
                throw new HttpTimeoutException("Remote download timed out");
            }
            TransportResponse response = responseSender.send(current, remainingNanos);
            int status = response.statusCode();
            if (isRedirect(status)) {
                response.body().close();
                String location = response.location();
                if (location == null || location.isBlank()) {
                    throw new UploadValidationException("REMOTE_ASSET_FAILED", "Redirect without Location");
                }
                current = RemoteUrlValidator.requirePublicHttpUrl(current.resolve(location));
                continue;
            }
            long bodyRemainingNanos = deadline - System.nanoTime();
            if (bodyRemainingNanos <= 0) {
                response.body().close();
                throw new HttpTimeoutException("Remote download timed out");
            }
            return new RemoteResponse(
                    current,
                    status,
                    response.contentType(),
                    response.contentLength(),
                    new DeadlineInputStream(response.body(), bodyRemainingNanos)
            );
        }
        throw new UploadValidationException("REMOTE_ASSET_FAILED", "Too many redirects");
    }

    private static boolean isRedirect(int status) {
        return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
    }

    @FunctionalInterface
    private interface ResponseSender {

        TransportResponse send(URI uri, long remainingNanos) throws IOException, InterruptedException;
    }

    private record TransportResponse(
            int statusCode,
            String location,
            String contentType,
            Long contentLength,
            InputStream body
    ) {
    }

    private record JdkResponseSender(HttpClient httpClient) implements ResponseSender {

        @Override
        public TransportResponse send(URI uri, long remainingNanos) throws IOException, InterruptedException {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofNanos(remainingNanos))
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "*/*")
                    .GET()
                    .build();
            HttpResponse<InputStream> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofInputStream()
            );
            long contentLength = response.headers().firstValueAsLong("Content-Length").orElse(-1);
            return new TransportResponse(
                    response.statusCode(),
                    response.headers().firstValue("Location").orElse(null),
                    response.headers().firstValue("Content-Type").orElse(null),
                    contentLength > 0 ? contentLength : null,
                    response.body()
            );
        }
    }

    private static final class PinnedResponseSender implements ResponseSender {

        @Override
        public TransportResponse send(URI uri, long remainingNanos) throws IOException {
            String expectedHost = uri.getHost();
            String expectedDnsHost = stripIpv6Brackets(expectedHost);
            InetAddress[] pinnedAddresses = RemoteUrlValidator.resolvePublicAddresses(expectedHost);
            long remainingMillis = Math.max(1, TimeUnit.NANOSECONDS.toMillis(remainingNanos));
            long connectMillis = Math.min(Duration.ofSeconds(10).toMillis(), remainingMillis);
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
                        throw new UnknownHostException("Unexpected remote host");
                    }
                }
            };
            var connectionManager = PoolingHttpClientConnectionManagerBuilder.create()
                    .setDnsResolver(pinnedResolver)
                    .setDefaultConnectionConfig(ConnectionConfig.custom()
                            .setConnectTimeout(Timeout.ofMilliseconds(connectMillis))
                            .build())
                    .build();
            CloseableHttpClient client = HttpClients.custom()
                    .setConnectionManager(connectionManager)
                    .disableAutomaticRetries()
                    .disableContentCompression()
                    .disableRedirectHandling()
                    .build();
            HttpGet request = new HttpGet(uri);
            request.setHeader("User-Agent", USER_AGENT);
            request.setHeader("Accept", "*/*");
            request.setConfig(RequestConfig.custom()
                    .setResponseTimeout(Timeout.ofMilliseconds(remainingMillis))
                    .build());

            try {
                ClassicHttpResponse response = client.executeOpen(null, request, null);
                HttpEntity entity = response.getEntity();
                InputStream content = entity == null ? InputStream.nullInputStream() : entity.getContent();
                long contentLength = entity == null ? -1 : entity.getContentLength();
                Header location = response.getFirstHeader("Location");
                return new TransportResponse(
                        response.getCode(),
                        location == null ? null : location.getValue(),
                        entity == null ? null : entity.getContentType(),
                        contentLength > 0 ? contentLength : null,
                        new OwnedResponseInputStream(content, response, client)
                );
            } catch (IOException | RuntimeException ex) {
                client.close();
                throw ex;
            }
        }

        private static String stripIpv6Brackets(String host) {
            if (host.startsWith("[") && host.endsWith("]")) {
                return host.substring(1, host.length() - 1);
            }
            return host;
        }
    }

    private static final class OwnedResponseInputStream extends FilterInputStream {

        private final ClassicHttpResponse response;
        private final CloseableHttpClient client;

        private OwnedResponseInputStream(
                InputStream delegate,
                ClassicHttpResponse response,
                CloseableHttpClient client
        ) {
            super(delegate);
            this.response = response;
            this.client = client;
        }

        @Override
        public void close() throws IOException {
            try {
                super.close();
            } finally {
                try {
                    response.close();
                } finally {
                    client.close();
                }
            }
        }
    }

    static final class DeadlineInputStream extends FilterInputStream {

        private final ScheduledFuture<?> deadlineTask;
        private volatile boolean timedOut;

        /** Closes {@code delegate} once the body-read deadline expires. */
        DeadlineInputStream(InputStream delegate, long remainingNanos) {
            super(delegate);
            deadlineTask = BODY_DEADLINE_EXECUTOR.schedule(() -> {
                timedOut = true;
                try {
                    delegate.close();
                } catch (IOException ignored) {
                    // The blocked reader observes the original close failure.
                }
            }, Math.max(1, remainingNanos), TimeUnit.NANOSECONDS);
        }

        @Override
        public int read() throws IOException {
            try {
                int result = super.read();
                throwIfTimedOut();
                return result;
            } catch (IOException ex) {
                throw timeoutOrOriginal(ex);
            }
        }

        @Override
        public int read(byte[] bytes, int offset, int length) throws IOException {
            try {
                int result = super.read(bytes, offset, length);
                throwIfTimedOut();
                return result;
            } catch (IOException ex) {
                throw timeoutOrOriginal(ex);
            }
        }

        @Override
        public void close() throws IOException {
            deadlineTask.cancel(false);
            super.close();
        }

        private void throwIfTimedOut() throws HttpTimeoutException {
            if (timedOut) {
                throw new HttpTimeoutException("Remote response body timed out");
            }
        }

        private IOException timeoutOrOriginal(IOException cause) {
            if (!timedOut || cause instanceof HttpTimeoutException) {
                return cause;
            }
            HttpTimeoutException timeout = new HttpTimeoutException("Remote response body timed out");
            timeout.initCause(cause);
            return timeout;
        }
    }
}
