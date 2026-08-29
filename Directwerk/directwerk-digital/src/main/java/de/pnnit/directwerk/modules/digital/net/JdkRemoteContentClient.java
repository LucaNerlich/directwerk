package de.pnnit.directwerk.modules.digital.net;

import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.stereotype.Component;

/**
 * JDK {@link HttpClient} that follows a small number of redirects and re-validates each hop.
 */
@Component
public class JdkRemoteContentClient implements RemoteContentClient {

    private static final int MAX_REDIRECTS = 4;
    private static final String USER_AGENT = "DirectwerkRssImport/1.0";

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
            return new RemoteResponse(
                    current,
                    status,
                    contentType,
                    contentLength > 0 ? contentLength : null,
                    response.body()
            );
        }
        throw new UploadValidationException("REMOTE_ASSET_FAILED", "Too many redirects");
    }

    private static boolean isRedirect(int status) {
        return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
    }
}
