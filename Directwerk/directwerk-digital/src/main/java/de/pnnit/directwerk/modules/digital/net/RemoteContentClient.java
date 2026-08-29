package de.pnnit.directwerk.modules.digital.net;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;

/**
 * Opens a remote HTTP GET as a stream so callers can copy bytes without buffering the body.
 */
public interface RemoteContentClient {

    /**
 * Opens a remote HTTP GET request and exposes its response as a stream.
 *
 * @param uri the remote resource URI
 * @param timeout the maximum time allowed for the request
 * @return the remote response and its streaming body
 * @throws IOException if an I/O error occurs
 * @throws InterruptedException if the operation is interrupted
 */
RemoteResponse get(URI uri, Duration timeout) throws IOException, InterruptedException;

    record RemoteResponse(
            URI finalUri,
            int statusCode,
            String contentType,
            Long contentLength,
            InputStream body
    ) implements AutoCloseable {

        /**
         * Closes the response body stream when one is present.
         */
        @Override
        public void close() throws IOException {
            if (body != null) {
                body.close();
            }
        }
    }
}
