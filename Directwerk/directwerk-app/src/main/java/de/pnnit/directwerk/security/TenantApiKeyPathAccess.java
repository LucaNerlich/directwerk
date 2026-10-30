package de.pnnit.directwerk.security;

import de.pnnit.directwerk.modules.core.apikey.TenantApiKeyScopes;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Path/method gate for opaque tenant API keys: content editor bases plus formats/categories
 * (MCP taxonomy), never {@code /api/v1/tenant/**} admin surface.
 */
public final class TenantApiKeyPathAccess {

    private TenantApiKeyPathAccess() {
    }

    public static boolean isAllowedPath(String path) {
        if (path == null) {
            return false;
        }
        if (path.startsWith("/api/v1/tenant/") || "/api/v1/tenant".equals(path)) {
            return false;
        }
        for (String base : allowedBases()) {
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
        List<String> bases = new ArrayList<>(RequestScope.editorContentBases());
        bases.addAll(RequestScope.tenantAdminContentBases());
        return List.copyOf(bases);
    }
}
