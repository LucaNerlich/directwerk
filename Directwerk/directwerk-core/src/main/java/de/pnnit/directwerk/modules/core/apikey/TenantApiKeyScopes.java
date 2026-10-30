package de.pnnit.directwerk.modules.core.apikey;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Allowed scopes for inbound tenant API keys (v1: content only).
 */
public final class TenantApiKeyScopes {

    public static final String CONTENT_READ = "content:read";
    public static final String CONTENT_WRITE = "content:write";

    private static final Set<String> KNOWN = Set.of(CONTENT_READ, CONTENT_WRITE);

    private TenantApiKeyScopes() {
    }

    public static Set<String> normalize(Set<String> raw) {
        if (raw == null || raw.isEmpty()) {
            throw new IllegalArgumentException("At least one scope is required");
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String scope : raw) {
            if (scope == null || scope.isBlank()) {
                throw new IllegalArgumentException("Scope must not be blank");
            }
            String value = scope.trim().toLowerCase(Locale.ROOT);
            if (!KNOWN.contains(value)) {
                throw new IllegalArgumentException("Unsupported scope: " + scope);
            }
            normalized.add(value);
        }
        return normalized;
    }

    public static boolean allowsRead(Set<String> scopes) {
        return scopes != null
                && (scopes.contains(CONTENT_READ) || scopes.contains(CONTENT_WRITE));
    }

    public static boolean allowsWrite(Set<String> scopes) {
        return scopes != null && scopes.contains(CONTENT_WRITE);
    }
}
