package de.pnnit.directwerk.modules.digital.net;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;

/**
 * Opens a remote HTTP GET as a stream so callers can copy bytes without buffering the body.
 */
public interface RemoteContentClient {

    RemoteResponse get(URI uri, Duration timeout) throws IOException, InterruptedException;

    record RemoteResponse(
            URI finalUri,
            int statusCode,
            String contentType,
            Long contentLength,
            InputStream body
    ) implements AutoCloseable {

        @Override
        public void close() throws IOException {
            if (body != null) {
                body.close();
            }
        }
    }
}
