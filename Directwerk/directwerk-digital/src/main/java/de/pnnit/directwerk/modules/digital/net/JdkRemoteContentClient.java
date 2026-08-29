package de.pnnit.directwerk.modules.digital.net;

import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

/**
 * JDK {@link HttpClient} that follows a small number of redirects and re-validates each hop.
 */
@Component
public class JdkRemoteContentClient implements RemoteContentClient {

    private static final int MAX_REDIRECTS = 4;
    private static final String USER_AGENT = "DirectwerkRssImport/1.0";
    private static final ScheduledExecutorService BODY_DEADLINE_EXECUTOR =
            Executors.newSingleThreadScheduledExecutor(runnable -> {
                Thread thread = new Thread(runnable, "remote-content-deadline");
                thread.setDaemon(true);
                return thread;
            });

    private final HttpClient httpClient;

    public JdkRemoteContentClient() {
        this(HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .connectTimeout(Duration.ofSeconds(10))
                .build());
    }

    JdkRemoteContentClient(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

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
            HttpRequest request = HttpRequest.newBuilder(current)
                    .timeout(Duration.ofNanos(remainingNanos))
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "*/*")
                    .GET()
                    .build();
            HttpResponse<java.io.InputStream> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofInputStream()
            );
            int status = response.statusCode();
            if (isRedirect(status)) {
                response.body().close();
                String location = response.headers().firstValue("Location").orElse(null);
                if (location == null || location.isBlank()) {
                    throw new UploadValidationException("REMOTE_ASSET_FAILED", "Redirect without Location");
                }
                current = RemoteUrlValidator.requirePublicHttpUrl(current.resolve(location));
                continue;
            }
            String contentType = response.headers().firstValue("Content-Type").orElse(null);
            Long contentLength = response.headers().firstValueAsLong("Content-Length").orElse(-1);
            long bodyRemainingNanos = deadline - System.nanoTime();
            if (bodyRemainingNanos <= 0) {
                response.body().close();
                throw new HttpTimeoutException("Remote download timed out");
            }
            return new RemoteResponse(
                    current,
                    status,
                    contentType,
                    contentLength > 0 ? contentLength : null,
                    new DeadlineInputStream(response.body(), bodyRemainingNanos)
            );
        }
        throw new UploadValidationException("REMOTE_ASSET_FAILED", "Too many redirects");
    }

    private static boolean isRedirect(int status) {
        return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
    }

    static final class DeadlineInputStream extends FilterInputStream {

        private final ScheduledFuture<?> deadlineTask;
        private volatile boolean timedOut;

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
