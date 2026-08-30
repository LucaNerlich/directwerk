package de.pnnit.directwerk.multitenancy;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.util.TenantHostname;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Resolves the tenant routing host for an HTTP request.
 *
 * <p>Browser traffic arrives on verified tenant domains and uses {@link HttpServletRequest#getServerName()}
 * directly. BFF upstream calls hit the platform API hostname ({@code DIRECTWERK_ISSUER}) and carry the
 * selected tenant in {@code X-Forwarded-Host} / {@code Forwarded} / {@code X-Tenant-Host}.
 */
@Component
@RequiredArgsConstructor
public class TenantRoutingHostResolver {

    private final DirectwerkConfig directwerkConfig;

    public String resolve(HttpServletRequest request) {
        String serverName = normalizeServerName(request.getServerName());
        Optional<String> explicitTenant = parseHeaderHost(request.getHeader("X-Tenant-Host"));
        String platformApiHost = platformApiHost();

        if (platformApiHost != null && platformApiHost.equalsIgnoreCase(serverName)) {
            return resolveFromBffHeaders(request, platformApiHost, explicitTenant, serverName);
        }

        // BFF upstream: explicit tenant header on the platform API hostname even when issuer
        // metadata is missing or getServerName() was already rewritten by the reverse proxy.
        if (explicitTenant.isPresent() && !explicitTenant.get().equalsIgnoreCase(serverName)) {
            return explicitTenant.get();
        }

        return serverName;
    }

    /**
     * True when tenant routing resolves to the platform API hostname (no selected tenant).
     */
    public boolean resolvesToPlatformApiHost(HttpServletRequest request) {
        String platformApiHost = platformApiHost();
        if (platformApiHost == null) {
            return false;
        }
        return platformApiHost.equalsIgnoreCase(resolve(request));
    }

    private static String resolveFromBffHeaders(
            HttpServletRequest request,
            String platformApiHost,
            Optional<String> explicitTenant,
            String serverName
    ) {
        return explicitTenant
                .or(() -> parseForwardedHeader(request.getHeader("Forwarded")))
                .or(() -> parseForwardedHostChain(request.getHeader("X-Forwarded-Host"), platformApiHost))
                .orElse(serverName);
    }

    private static String normalizeServerName(String serverName) {
        if (!StringUtils.hasText(serverName)) {
            return serverName;
        }
        String candidate = serverName.trim().toLowerCase(Locale.ROOT);
        int colon = candidate.indexOf(':');
        return colon >= 0 ? candidate.substring(0, colon) : candidate;
    }

    private String platformApiHost() {
        String issuer = directwerkConfig.security().issuer();
        if (!StringUtils.hasText(issuer)) {
            return null;
        }
        try {
            URI uri = URI.create(issuer.trim());
            return uri.getHost() == null ? null : uri.getHost().toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static Optional<String> parseHeaderHost(String rawHeader) {
        if (!StringUtils.hasText(rawHeader)) {
            return Optional.empty();
        }
        String first = rawHeader.split(",")[0].trim();
        if (first.isEmpty()) {
            return Optional.empty();
        }
        return normalizeRoutingHost(first);
    }

    private static Optional<String> parseHeaderHostExcluding(String rawHeader, String excludedHost) {
        return parseHeaderHost(rawHeader).filter(host -> !host.equalsIgnoreCase(excludedHost));
    }

    /**
     * Traefik may prepend the API hostname to an existing forwarded-host chain from the BFF.
     * Prefer the last non-platform entry.
     */
    static Optional<String> parseForwardedHostChain(String rawHeader, String platformApiHost) {
        if (!StringUtils.hasText(rawHeader)) {
            return Optional.empty();
        }
        Optional<String> lastNonPlatform = Optional.empty();
        for (String segment : rawHeader.split(",")) {
            Optional<String> parsed = normalizeRoutingHost(segment.trim());
            if (parsed.isPresent() && !parsed.get().equalsIgnoreCase(platformApiHost)) {
                lastNonPlatform = parsed;
            }
        }
        return lastNonPlatform;
    }

    static Optional<String> parseForwardedHeader(String rawHeader) {
        if (!StringUtils.hasText(rawHeader)) {
            return Optional.empty();
        }
        String first = rawHeader.split(",")[0].trim();
        for (String part : first.split(";")) {
            String trimmed = part.trim();
            if (!trimmed.regionMatches(true, 0, "host=", 0, 5)) {
                continue;
            }
            String value = trimmed.substring(5).trim();
            if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
                value = value.substring(1, value.length() - 1);
            }
            Optional<String> parsed = normalizeRoutingHost(value);
            if (parsed.isPresent()) {
                return parsed;
            }
        }
        return Optional.empty();
    }

    private static Optional<String> normalizeRoutingHost(String rawHost) {
        if (!StringUtils.hasText(rawHost)) {
            return Optional.empty();
        }
        String withoutPort = rawHost.trim();
        if (withoutPort.startsWith("[") && withoutPort.contains("]")) {
            int end = withoutPort.indexOf(']');
            withoutPort = withoutPort.substring(1, end);
        } else {
            int colon = withoutPort.indexOf(':');
            if (colon >= 0) {
                withoutPort = withoutPort.substring(0, colon);
            }
        }
        try {
            return Optional.of(TenantHostname.normalize(withoutPort));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
