package de.pnnit.directwerk.security;

import jakarta.annotation.Nullable;
import java.util.List;

/**
 * The one taxonomy for "what kind of API route is this?".
 *
 * <p>Previously restated as divergent prefix lists in {@code TenantContextFilter} and
 * {@code TenantMembershipGuardFilter}; both now consume this classification so adding a
 * route means updating one place. Method-level {@code @PreAuthorize} and the SecurityConfig
 * matcher table remain separate, deliberate enforcement layers — but SecurityConfig builds
 * its content matchers from {@link #editorContentBases()} and
 * {@link #tenantAdminContentBases()}, and {@code RequestScopeSecurityConsistencyTest} pins
 * the two taxonomies together, so a new content route cannot silently drift.</p>
 */
public enum RequestScope {

    /** No auth required; Host tenant context is best-effort (public site, feeds, docs). */
    PUBLIC(false, RoleRequirement.NONE),

    /** Platform-admin surface; never receives a tenant context; no DB membership re-check. */
    PLATFORM(false, RoleRequirement.NONE),

    /** Tenant administration — requires ACTIVE TENANT_ADMIN membership from the DB. */
    TENANT_ADMIN_AREA(true, RoleRequirement.TENANT_ADMIN),

    /** Content management — requires ACTIVE EDITOR or TENANT_ADMIN membership from the DB. */
    EDITOR_CONTENT(true, RoleRequirement.EDITOR_OR_TENANT_ADMIN),

    /** Editor/admin diagnostics — same DB re-check as content management. */
    PROBES(true, RoleRequirement.EDITOR_OR_TENANT_ADMIN),

    /** Authenticated member surface ({@code /me}, {@code /security}) — any ACTIVE membership. */
    MEMBER(true, RoleRequirement.ANY_ACTIVE);

    private final boolean tenantScoped;
    private final RoleRequirement roleRequirement;

    RequestScope(boolean tenantScoped, RoleRequirement roleRequirement) {
        this.tenantScoped = tenantScoped;
        this.roleRequirement = roleRequirement;
    }

    public boolean isTenantScoped() {
        return tenantScoped;
    }

    public RoleRequirement roleRequirement() {
        return roleRequirement;
    }

    /** Which DB-membership roles the scope demands (in addition to JWT method security). */
    public enum RoleRequirement {
        NONE, TENANT_ADMIN, EDITOR_OR_TENANT_ADMIN, ANY_ACTIVE
    }

    private static final String PLATFORM_SECURITY_PATH = "/api/v1/security/platform";
    private static final String[] PUBLIC_PREFIXES = {
            "/api/v1/public/", "/api/v1/auth/", "/feeds/",
            "/actuator/", "/swagger-ui", "/v3/api-docs"
    };
    private static final String[] PLATFORM_PREFIXES = {"/api/v1/platform/", "/api/v1/webhooks/"};
    private static final String[] EDITOR_CONTENT_BASES = {
            "/api/v1/media", "/api/v1/series", "/api/v1/episodes",
            "/api/v1/articles", "/api/v1/podcast/import"
    };
    /**
     * Content routes reserved to tenant admins. Classified as {@link #TENANT_ADMIN_AREA}
     * (not {@link #EDITOR_CONTENT}) to match the SecurityConfig matcher table, which has
     * always required {@code TENANT_ADMIN} JWT role here — the membership re-check now agrees
     * instead of being the looser layer.
     */
    private static final String[] TENANT_ADMIN_CONTENT_BASES = {
            "/api/v1/formats", "/api/v1/categories"
    };

    /** Content path roots shared with the SecurityConfig matcher table — the single owner. */
    public static List<String> editorContentBases() {
        return List.of(EDITOR_CONTENT_BASES);
    }

    /** Tenant-admin-only content path roots shared with the SecurityConfig matcher table. */
    public static List<String> tenantAdminContentBases() {
        return List.of(TENANT_ADMIN_CONTENT_BASES);
    }

    /** Turns content bases into {@code <base>/**} matcher patterns. */
    public static List<String> antPatterns(List<String> bases) {
        return bases.stream().map(base -> base + "/**").toList();
    }

    /**
     * Classifies a request path. Order matters: the platform-exact security path wins over
     * its own prefix family; PUBLIC beats the generic {@code /api/v1/} tenant rule.
     */
    public static RequestScope of(@Nullable String path) {
        if (path == null) {
            return PUBLIC;
        }
        if (PLATFORM_SECURITY_PATH.equals(path) || isUnderAny(path, PLATFORM_PREFIXES)) {
            return PLATFORM;
        }
        if (isUnderAny(path, PUBLIC_PREFIXES)) {
            return PUBLIC;
        }
        if (path.startsWith("/api/v1/tenant/")) {
            return TENANT_ADMIN_AREA;
        }
        if (path.startsWith("/api/v1/probes/")) {
            return PROBES;
        }
        if ("/api/v1/me".equals(path) || path.startsWith("/api/v1/me/")
                || path.startsWith("/api/v1/security/")) {
            return MEMBER;
        }
        if (isUnderAny(path, TENANT_ADMIN_CONTENT_BASES)) {
            return TENANT_ADMIN_AREA;
        }
        if (isEditorContent(path)) {
            return EDITOR_CONTENT;
        }
        // Unknown authenticated API routes are member-scoped by default — fail closed.
        if (path.startsWith("/api/v1/")) {
            return MEMBER;
        }
        return PUBLIC;
    }

    private static boolean isEditorContent(String path) {
        for (String base : EDITOR_CONTENT_BASES) {
            if (path.equals(base) || path.startsWith(base + "/")) {
                return true;
            }
        }
        return false;
    }

    private static boolean isUnderAny(String path, String... prefixes) {
        for (String prefix : prefixes) {
            if (path.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
}
