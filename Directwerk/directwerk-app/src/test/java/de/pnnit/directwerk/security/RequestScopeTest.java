package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Single taxonomy for route classification — both servlet filters consume it, so drift here
 * would silently change tenant isolation or membership re-checking.
 */
class RequestScopeTest {

    @Test
    void platformSurfaceIncludesWebhooksAndExactSecurityPlatformPath() {
        assertThat(RequestScope.of("/api/v1/platform/tenants")).isEqualTo(RequestScope.PLATFORM);
        assertThat(RequestScope.of("/api/v1/webhooks/stripe")).isEqualTo(RequestScope.PLATFORM);
        assertThat(RequestScope.of("/api/v1/security/platform")).isEqualTo(RequestScope.PLATFORM);
    }

    @Test
    void publicPathsCoverSiteFeedsAndDocs() {
        assertThat(RequestScope.of("/api/v1/public/site-config")).isEqualTo(RequestScope.PUBLIC);
        assertThat(RequestScope.of("/api/v1/auth/login")).isEqualTo(RequestScope.PUBLIC);
        assertThat(RequestScope.of("/feeds/alpha/podcast.xml")).isEqualTo(RequestScope.PUBLIC);
        assertThat(RequestScope.of("/actuator/health")).isEqualTo(RequestScope.PUBLIC);
        assertThat(RequestScope.of("/swagger-ui/index.html")).isEqualTo(RequestScope.PUBLIC);
        assertThat(RequestScope.of("/v3/api-docs")).isEqualTo(RequestScope.PUBLIC);
    }

    @Test
    void tenantAdminAreaDemandsTenantAdminMembership() {
        assertThat(RequestScope.of("/api/v1/tenant/subscribers"))
                .isEqualTo(RequestScope.TENANT_ADMIN_AREA);
        assertThat(RequestScope.of("/api/v1/tenant/subscriber-feeds/3/enabled"))
                .isEqualTo(RequestScope.TENANT_ADMIN_AREA);
        assertThat(RequestScope.of("/api/v1/tenant/subscribers").roleRequirement())
                .isEqualTo(RequestScope.RoleRequirement.TENANT_ADMIN);
    }

    @Test
    void tenantAdminContentBasesAreTenantAdminArea() {
        // Formats/categories are reserved to tenant admins — matches the SecurityConfig
        // matcher table, which never granted EDITOR here.
        for (String base : new String[] {"/api/v1/formats", "/api/v1/categories"}) {
            assertThat(RequestScope.of(base)).isEqualTo(RequestScope.TENANT_ADMIN_AREA);
            assertThat(RequestScope.of(base + "/7")).isEqualTo(RequestScope.TENANT_ADMIN_AREA);
            assertThat(RequestScope.of(base).roleRequirement())
                    .isEqualTo(RequestScope.RoleRequirement.TENANT_ADMIN);
        }
    }

    @Test
    void editorContentBasesRequireEditorOrAdmin() {
        for (String base : new String[] {"/api/v1/media", "/api/v1/series", "/api/v1/episodes",
                "/api/v1/articles", "/api/v1/podcast/import"}) {
            assertThat(RequestScope.of(base)).isEqualTo(RequestScope.EDITOR_CONTENT);
            assertThat(RequestScope.of(base + "/7")).isEqualTo(RequestScope.EDITOR_CONTENT);
            assertThat(RequestScope.of(base).roleRequirement())
                    .isEqualTo(RequestScope.RoleRequirement.EDITOR_OR_TENANT_ADMIN);
        }
    }

    @Test
    void memberSurfaceCoversMeAndSecurityButNotPlatformSecurity() {
        assertThat(RequestScope.of("/api/v1/me")).isEqualTo(RequestScope.MEMBER);
        assertThat(RequestScope.of("/api/v1/me/downloads")).isEqualTo(RequestScope.MEMBER);
        assertThat(RequestScope.of("/api/v1/security/probe")).isEqualTo(RequestScope.MEMBER);
    }

    @Test
    void probesAreEditorOrAdminScoped() {
        assertThat(RequestScope.of("/api/v1/probes/podcast")).isEqualTo(RequestScope.PROBES);
    }

    @Test
    void unknownApiRoutesFailClosedToMemberScope() {
        assertThat(RequestScope.of("/api/v1/something-new")).isEqualTo(RequestScope.MEMBER);
        // non-API paths behave as public (no context requirement), as before
        assertThat(RequestScope.of("/login")).isEqualTo(RequestScope.PUBLIC);
    }
}
