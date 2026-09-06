package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.util.AntPathMatcher;

/**
 * Pins the SecurityConfig matcher table against the {@link RequestScope} taxonomy.
 *
 * <p>{@code RequestScope} owns the classification; this test is the Seam that prevents
 * drift: adding a content route to {@code RequestScope} without a matching SecurityConfig
 * row (or vice versa) fails here, not in production. Three deliberate deviations are
 * asserted explicitly so future readers know they are intentional, not drift:
 * actuator narrowness, auth narrowness, and the JWT-less Stripe webhook.
 */
class RequestScopeSecurityConsistencyTest {

    private final AntPathMatcher matcher = new AntPathMatcher();

    private SecurityConfig.ApiAccess decisionFor(String path) {
        for (SecurityConfig.ApiAuthorizationRule rule : SecurityConfig.apiAuthorizationRules()) {
            for (String pattern : rule.patterns()) {
                if (matcher.match(pattern, path)) {
                    return rule.access();
                }
            }
        }
        return SecurityConfig.ApiAccess.AUTHENTICATED; // anyRequest()
    }

    @Test
    void editorContentBasesGrantEditorsInBothTaxonomies() {
        for (String base : RequestScope.editorContentBases()) {
            for (String path : List.of(base, base + "/7")) {
                assertThat(RequestScope.of(path))
                        .as("scope of %s", path)
                        .isEqualTo(RequestScope.EDITOR_CONTENT);
                assertThat(decisionFor(path))
                        .as("SecurityConfig decision for %s", path)
                        .isEqualTo(SecurityConfig.ApiAccess.EDITOR_OR_TENANT_ADMIN);
            }
        }
    }

    @Test
    void tenantAdminContentBasesDemandTenantAdminInBothTaxonomies() {
        for (String base : RequestScope.tenantAdminContentBases()) {
            for (String path : List.of(base, base + "/7")) {
                assertThat(RequestScope.of(path))
                        .as("scope of %s", path)
                        .isEqualTo(RequestScope.TENANT_ADMIN_AREA);
                assertThat(decisionFor(path))
                        .as("SecurityConfig decision for %s", path)
                        .isEqualTo(SecurityConfig.ApiAccess.TENANT_ADMIN);
            }
        }
        assertThat(RequestScope.of("/api/v1/tenant/subscribers"))
                .isEqualTo(RequestScope.TENANT_ADMIN_AREA);
        assertThat(decisionFor("/api/v1/tenant/subscribers"))
                .isEqualTo(SecurityConfig.ApiAccess.TENANT_ADMIN);
    }

    @Test
    void memberSurfaceIsAuthenticatedInBothTaxonomies() {
        for (String path : List.of("/api/v1/me", "/api/v1/me/downloads", "/api/v1/security/probe",
                "/api/v1/something-new")) {
            assertThat(RequestScope.of(path)).isEqualTo(RequestScope.MEMBER);
            assertThat(decisionFor(path))
                    .as("SecurityConfig decision for %s", path)
                    .isEqualTo(SecurityConfig.ApiAccess.AUTHENTICATED);
        }
    }

    @Test
    void publicPermitAllPathsAgree() {
        for (String path : List.of("/api/v1/public/site-config", "/feeds/alpha/podcast.xml",
                "/actuator/health", "/v3/api-docs/openapi.json", "/api/v1/auth/register")) {
            assertThat(RequestScope.of(path)).isEqualTo(RequestScope.PUBLIC);
            assertThat(decisionFor(path))
                    .as("SecurityConfig decision for %s", path)
                    .isEqualTo(SecurityConfig.ApiAccess.PERMIT_ALL);
        }
    }

    @Test
    void deliberateDeviationsStayDocumented() {
        // Actuator exposes only health/info anonymously at the JWT layer, although the whole
        // prefix is PUBLIC scope (best-effort tenant context, no membership re-check).
        assertThat(RequestScope.of("/actuator/metrics")).isEqualTo(RequestScope.PUBLIC);
        assertThat(decisionFor("/actuator/metrics"))
                .isEqualTo(SecurityConfig.ApiAccess.AUTHENTICATED);

        // Only anonymous auth endpoints are permitAll; login/refresh/logout live behind the
        // authorization-server chain.
        assertThat(RequestScope.of("/api/v1/auth/login")).isEqualTo(RequestScope.PUBLIC);
        assertThat(decisionFor("/api/v1/auth/login"))
                .isEqualTo(SecurityConfig.ApiAccess.AUTHENTICATED);

        // Stripe cannot present a JWT: PLATFORM scope but permitAll, verified via webhook
        // signature instead.
        assertThat(RequestScope.of("/api/v1/webhooks/stripe")).isEqualTo(RequestScope.PLATFORM);
        assertThat(decisionFor("/api/v1/webhooks/stripe"))
                .isEqualTo(SecurityConfig.ApiAccess.PERMIT_ALL);
    }
}
