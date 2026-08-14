package de.pnnit.directwerk.modules.digital.api;

import java.net.URL;

/**
 * Invalidates a public CDN URL after the origin object was removed.
 * Implementations must no-op when purge is not configured.
 */
public interface CdnPurgeClient {

    /**
     * Requests purge of {@code cdnUrl}. Failures are logged by the implementation;
     * callers treat purge as best-effort.
     *
     * @param cdnUrl absolute HTTPS CDN URL built by the application (never client input)
     */
    void purgeUrl(URL cdnUrl);
}
