package de.pnnit.directwerk.modules.digital.net;

import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Rejects URLs that would let a tenant-admin ingest request reach private or
 * link-local infrastructure (SSRF). Public HTTP(S) hosts only.
 */
public final class RemoteUrlValidator {

    /**
     * {@code InetAddress.getAllByName} has no timeout-capable overload and can block for
     * the OS resolver's full retry budget (often 10-30s) against an unresponsive
     * nameserver. Bounding it here keeps a single slow/hostile host from holding open the
     * caller's pooled DB transaction indefinitely.
     */
    private static final long RESOLVE_DEADLINE_MILLIS = 5_000;
    private static final ExecutorService RESOLVER_EXECUTOR = Executors.newCachedThreadPool(runnable -> {
        Thread thread = new Thread(runnable, "remote-url-dns-resolve");
        thread.setDaemon(true);
        return thread;
    });

    private RemoteUrlValidator() {
    }

    /**
     * Validates and parses a raw URL for public HTTP(S) access.
     *
     * @param rawUrl the URL to validate
     * @return the validated absolute HTTP(S) URI
     * @throws UploadValidationException if the URL is blank, malformed, or targets a blocked resource
     */
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

    /**
     * Validates that a URI uses HTTP or HTTPS and targets a publicly reachable host.
     *
     * @param uri the URI to validate
     * @return the validated URI
     * @throws UploadValidationException if the URI is missing, malformed for this purpose, uses an unsupported scheme,
     *                                   contains user information, or targets a blocked or non-public host
     */
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
        resolvePublicAddresses(host);
        return uri;
    }

    /**
     * Canonicalizes a validated import source URL for deduplication lookups.
     */
    public static String canonicalImportSourceUrl(String rawUrl) {
        return canonicalImportSourceUrl(requirePublicHttpUrl(rawUrl));
    }

    /**
     * Canonicalizes a validated import source URL for deduplication lookups.
     */
    public static String canonicalImportSourceUrl(URI uri) {
        if (uri == null || uri.getScheme() == null || uri.getHost() == null) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl must be an absolute HTTP(S) URL");
        }
        String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        int port = uri.getPort();
        if (("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443)) {
            port = -1;
        }
        String path = uri.getRawPath();
        if (path == null || path.isBlank()) {
            path = "/";
        }
        try {
            return new URI(
                    scheme,
                    null,
                    host,
                    port,
                    path,
                    uri.getRawQuery(),
                    null
            ).normalize().toASCIIString();
        } catch (URISyntaxException ex) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl is not valid", ex);
        }
    }

    /**
     * Resolves a hostname and verifies that all resulting addresses are publicly accessible.
     *
     * @param host the hostname to resolve
     * @return the resolved public addresses
     * @throws UploadValidationException if the host cannot be resolved or resolves to a blocked address
     */
    static InetAddress[] resolvePublicAddresses(String host) {
        return resolvePublicAddresses(host, () -> InetAddress.getAllByName(host));
    }

    /** Package-visible so tests can inject a slow/hanging resolver without real network delay. */
    static InetAddress[] resolvePublicAddresses(String host, java.util.concurrent.Callable<InetAddress[]> resolver) {
        InetAddress[] addresses;
        Future<InetAddress[]> pending = RESOLVER_EXECUTOR.submit(resolver);
        try {
            addresses = pending.get(RESOLVE_DEADLINE_MILLIS, TimeUnit.MILLISECONDS);
        } catch (TimeoutException ex) {
            pending.cancel(true);
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl host could not be resolved in time", ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            pending.cancel(true);
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl host resolution was interrupted", ex);
        } catch (ExecutionException ex) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl host could not be resolved", ex.getCause());
        }
        if (addresses.length == 0) {
            throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl host could not be resolved");
        }
        for (InetAddress address : addresses) {
            if (isBlockedAddress(address)) {
                throw new UploadValidationException("REMOTE_URL_FORBIDDEN", "sourceUrl must not target a private host");
            }
        }
        return addresses;
    }

    /**
     * Determines whether a hostname belongs to a blocked local or internal domain.
     *
     * @param host the hostname to evaluate
     * @return {@code true} if the hostname is blocked, {@code false} otherwise
     */
    private static boolean isBlockedHostname(String host) {
        return "localhost".equals(host)
                || host.endsWith(".localhost")
                || host.endsWith(".local")
                || host.endsWith(".internal")
                || host.endsWith(".intranet")
                || "metadata.google.internal".equals(host);
    }

    /**
     * Determines whether an IP address is unsuitable for public remote access.
     *
     * @param address the IP address to evaluate
     * @return {@code true} if the address is local, private, reserved, multicast, or unsupported; {@code false} otherwise
     */
    private static boolean isBlockedAddress(InetAddress address) {
        if (address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return true;
        }
        byte[] bytes = address.getAddress();
        if (bytes.length == 16) {
            // Java's isSiteLocalAddress() does not cover RFC 4193 unique-local
            // addresses (fc00::/7), which are private infrastructure too.
            return (bytes[0] & 0xfe) == 0xfc;
        }
        if (bytes.length == 4) {
            int first = Byte.toUnsignedInt(bytes[0]);
            int second = Byte.toUnsignedInt(bytes[1]);
            return first == 0
                    || (first == 100 && second >= 64 && second <= 127)
                    || (first == 198 && (second == 18 || second == 19));
        }
        return true;
    }
}
