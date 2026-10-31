package de.pnnit.directwerk.security;

import de.pnnit.directwerk.modules.core.apikey.TenantApiKeyScopes;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Path/method gate for opaque tenant API keys: Studio MCP content surface only
 * (articles, episodes, series, media, categories, formats). Never
 * {@code /api/v1/tenant/**}, and never deferred editor surfaces (imports, newsletter
 * lists, digital publications).
 */
public final class TenantApiKeyPathAccess {

    /**
     * Explicit v1 allowlist — do not reuse {@link RequestScope#editorContentBases()}, which
     * also covers deferred MCP surfaces.
     */
    private static final List<String> ALLOWED_BASES = List.of(
            "/mcp",
            "/api/v1/articles",
            "/api/v1/episodes",
            "/api/v1/series",
            "/api/v1/media",
            "/api/v1/categories",
            "/api/v1/formats"
    );

    /** Subpaths under an allowed base that remain out of scope for API keys. */
    private static final List<String> DENIED_PREFIXES = List.of(
            "/api/v1/articles/import"
    );

    private TenantApiKeyPathAccess() {
    }

    public static boolean isAllowedPath(String path) {
        if (path == null) {
            return false;
        }
        if (path.startsWith("/api/v1/tenant/") || "/api/v1/tenant".equals(path)) {
            return false;
        }
        for (String denied : DENIED_PREFIXES) {
            if (path.equals(denied) || path.startsWith(denied + "/")) {
                return false;
            }
        }
        for (String base : ALLOWED_BASES) {
            if (path.equals(base) || path.startsWith(base + "/")) {
                return true;
            }
        }
        return false;
    }

    public static boolean isMethodAllowed(String method, Set<String> scopes) {
        if (method == null) {
            return false;
        }
        String verb = method.toUpperCase(Locale.ROOT);
        if ("GET".equals(verb) || "HEAD".equals(verb) || "OPTIONS".equals(verb)) {
            return TenantApiKeyScopes.allowsRead(scopes);
        }
        return TenantApiKeyScopes.allowsWrite(scopes);
    }

    static List<String> allowedBases() {
        return ALLOWED_BASES;
    }
}
