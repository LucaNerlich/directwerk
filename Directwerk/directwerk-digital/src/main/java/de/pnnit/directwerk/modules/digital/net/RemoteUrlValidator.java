package de.pnnit.directwerk.modules.digital.net;

import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;

/**
 * Rejects URLs that would let a tenant-admin ingest request reach private or
 * link-local infrastructure (SSRF). Public HTTP(S) hosts only.
 */
public final class RemoteUrlValidator {

    private RemoteUrlValidator() {
    }

    public static URI requirePublicHttpUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl is required");
        }
        URI uri;
        try {
            uri = URI.create(rawUrl.trim());
        } catch (IllegalArgumentException ex) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl is not a valid URL", ex);
        }
        return requirePublicHttpUrl(uri);
    }

    public static URI requirePublicHttpUrl(URI uri) {
        if (uri == null || uri.getScheme() == null || uri.getHost() == null) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl must be an absolute HTTP(S) URL");
        }
        String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"https".equals(scheme) && !"http".equals(scheme)) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl must use http or https");
        }
        if (uri.getUserInfo() != null && !uri.getUserInfo().isBlank()) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl must not include userinfo");
        }
        String host = uri.getHost().trim().toLowerCase(Locale.ROOT);
        if (host.isEmpty() || isBlockedHostname(host)) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl host is not allowed");
        }
        InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(host);
        } catch (UnknownHostException ex) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl host could not be resolved", ex);
        }
        if (addresses.length == 0) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl host could not be resolved");
        }
        for (InetAddress address : addresses) {
            if (isBlockedAddress(address)) {
                throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl must not target a private host");
            }
        }
        return uri;
    }

    private static boolean isBlockedHostname(String host) {
        return "localhost".equals(host)
                || host.endsWith(".localhost")
                || host.endsWith(".local")
                || host.endsWith(".internal")
                || host.endsWith(".intranet")
                || "metadata.google.internal".equals(host);
    }

    private static boolean isBlockedAddress(InetAddress address) {
        return address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress();
    }
}
