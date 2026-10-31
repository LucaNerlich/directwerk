package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.modules.core.apikey.TenantApiKeyScopes;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TenantApiKeyPathAccessTest {

    @Test
    void allowsEditorContentAndTaxonomyPaths() {
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/mcp")).isTrue();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/mcp/")).isTrue();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/articles")).isTrue();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/articles/1")).isTrue();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/articles/1/categories")).isTrue();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/episodes")).isTrue();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/series/3")).isTrue();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/media/folders")).isTrue();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/categories")).isTrue();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/formats/9")).isTrue();
    }

    @Test
    void rejectsTenantAdminSurface() {
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/tenant/api-keys")).isFalse();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/tenant/users")).isFalse();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/tenant/branding")).isFalse();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/me/access")).isFalse();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/platform/tenants")).isFalse();
    }

    @Test
    void rejectsDeferredEditorSurfacesBeyondMcpV1() {
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/articles/import")).isFalse();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/articles/import/jobs")).isFalse();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/newsletter-lists")).isFalse();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/newsletter-lists/1/subscriptions")).isFalse();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/podcast/import")).isFalse();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/digital-publications")).isFalse();
        assertThat(TenantApiKeyPathAccess.isAllowedPath("/api/v1/digital-publications/1")).isFalse();
    }

    @Test
    void readScopeAllowsGetOnly() {
        Set<String> read = Set.of(TenantApiKeyScopes.CONTENT_READ);
        assertThat(TenantApiKeyPathAccess.isMethodAllowed("GET", read)).isTrue();
        assertThat(TenantApiKeyPathAccess.isMethodAllowed("POST", read)).isFalse();
        assertThat(TenantApiKeyPathAccess.isMethodAllowed("DELETE", read)).isFalse();
    }

    @Test
    void writeScopeAllowsMutations() {
        Set<String> write = Set.of(TenantApiKeyScopes.CONTENT_WRITE);
        assertThat(TenantApiKeyPathAccess.isMethodAllowed("GET", write)).isTrue();
        assertThat(TenantApiKeyPathAccess.isMethodAllowed("POST", write)).isTrue();
        assertThat(TenantApiKeyPathAccess.isMethodAllowed("PUT", write)).isTrue();
        assertThat(TenantApiKeyPathAccess.isMethodAllowed("DELETE", write)).isTrue();
    }
}
