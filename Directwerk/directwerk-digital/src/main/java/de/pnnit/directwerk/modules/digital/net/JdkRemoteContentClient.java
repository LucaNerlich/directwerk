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
     * Downloads a public HTTP(S) resource and follows validated redirects within the request timeout.
     *
     * @param uri     the resource URI to request
     * @param timeout the overall request and response-body timeout, or {@code null} for 15 minutes
     * @return the remote response and its bounded body stream
     * @throws IOException              if the resource cannot be read
     * @throws InterruptedException     if the request is interrupted
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

    /**
     * Determines whether an HTTP status code represents a supported redirect.
     *
     * @param status the HTTP status code
     * @return {@code true} if the status code is 301, 302, 303, 307, or 308; {@code false} otherwise
     */
    private static boolean isRedirect(int status) {
        return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
    }

    @FunctionalInterface
    private interface ResponseSender {

        /**
 * Sends a request for the specified URI within the remaining time budget.
 *
 * @param uri the request target
 * @param remainingNanos the remaining timeout in nanoseconds
 * @return the response and its metadata
 */
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

        /**
         * Sends a GET request using the resolved public addresses for the target host.
         *
         * @param uri            the request URI
         * @param remainingNanos the time remaining for the request, in nanoseconds
         * @return the HTTP response and its response body
         */
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

        /**
         * Removes enclosing brackets from an IPv6 host string.
         *
         * @param host the host string to normalize
         * @return the host without enclosing IPv6 brackets
         */
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

        /**
         * Closes the response stream, HTTP response, and client.
         *
         * @throws IOException if closing the response stream fails
         */
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

        /**
         * Wraps a response stream and closes it when the specified body-read deadline expires.
         *
         * @param delegate      the underlying response stream
         * @param remainingNanos the time remaining before the body-read deadline, in nanoseconds
         */
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

        /**
         * Reads the next byte and enforces the stream deadline.
         *
         * @return the byte read, or {@code -1} if the end of the stream is reached
         */
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

        /**
         * Reads bytes from the underlying response stream while enforcing the deadline.
         *
         * @return the number of bytes read, or {@code -1} if the end of the stream is reached
         * @throws HttpTimeoutException if the deadline expires during the read
         * @throws IOException if reading the underlying stream fails
         */
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

        /**
         * Ensures that reading the response body has not exceeded its deadline.
         *
         * @throws HttpTimeoutException if the response body deadline has expired
         */
        private void throwIfTimedOut() throws HttpTimeoutException {
            if (timedOut) {
                throw new HttpTimeoutException("Remote response body timed out");
            }
        }

        /**
         * Converts a body-read failure into a timeout exception when the deadline has expired.
         *
         * @param cause the original read failure
         * @return the original exception, or a timeout exception retaining it as the cause
         */
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
