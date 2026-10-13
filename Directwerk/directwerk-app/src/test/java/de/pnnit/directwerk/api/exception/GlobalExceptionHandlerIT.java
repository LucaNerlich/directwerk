package de.pnnit.directwerk.api.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.testsupport.PlatformAdminApiTestSupport;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/**
 * Guards the API-wide error contract: every failure — unknown routes, wrong methods, malformed
 * bodies, type mismatches, validation failures, missing auth, insufficient roles — must leave the
 * API as the standard {@code Response<T>} envelope ({@code statusCode}/{@code statusMessage} plus
 * an {@code errors} array carrying machine-readable {@code code}s), never as a Spring default
 * body or an HTML error page.
 *
 * <p>Platform routes are requested with a real platform-admin token (see
 * {@link PlatformAdminApiTestSupport}) so the requests reach the dispatcher rather than being
 * rejected earlier by {@code PlatformAdminGuardFilter}.
 */
class GlobalExceptionHandlerIT extends PlatformAdminApiTestSupport {

    @Autowired
    private TenantRepository tenantRepository;

    private Tenant tenant;

    @BeforeEach
    void seedTenant() {
        tenant = new Tenant();
        tenant.setSlug("envelope-" + UUID.randomUUID().toString().substring(0, 8));
        tenant.setName("Envelope");
        tenant.setStatus(TenantStatus.ACTIVE);
        tenant = tenantRepository.save(tenant);
    }

    @Test
    void unknownRouteReturnsNotFoundEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/platform/no-such-route").with(asPlatformAdmin()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.statusCode").value(404))
                .andExpect(jsonPath("$.statusMessage").value("NOT_FOUND"))
                .andExpect(jsonPath("$.errors[0].code").value("NOT_FOUND"));
    }

    @Test
    void wrongMethodReturnsMethodNotAllowedEnvelope() throws Exception {
        mockMvc.perform(post("/api/v1/platform/overview").with(asPlatformAdmin()))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.statusCode").value(405))
                .andExpect(jsonPath("$.errors[0].code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    void malformedJsonReturnsBadRequestEnvelope() throws Exception {
        mockMvc.perform(post("/api/v1/platform/tenants")
                        .with(asPlatformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": broken"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.errors[0].code").value("MESSAGE_NOT_READABLE"));
    }

    @Test
    void pathTypeMismatchReturnsValidationEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/platform/tenants/not-a-number").with(asPlatformAdmin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));
    }

    @Test
    void beanValidationFailureUsesCodeAsStatusMessage() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{id}", tenant.getId())
                        .with(asPlatformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"Invalid Slug!\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.statusMessage").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));
    }

    @Test
    void anonymousPlatformRouteReturnsUnauthorizedEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/platform/tenants"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.statusCode").value(401))
                .andExpect(jsonPath("$.errors[0].code").value("UNAUTHORIZED"));
    }

    @Test
    void insufficientRoleReturnsAccessDeniedEnvelope() throws Exception {
        // An authenticated non-platform user is rejected by PlatformAdminGuardFilter, which
        // re-checks the platform-admin grant against the DB before the controller's
        // @PreAuthorize runs — hence PLATFORM_ADMIN_ACCESS_DENIED rather than a Spring
        // method-security ACCESS_DENIED.
        String tenantToken = mintToken(
                seedUser("tenant-user").getId(), tenant.getId(), List.of("TENANT_ADMIN"));

        mockMvc.perform(get("/api/v1/platform/tenants").with(bearer(tenantToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.statusCode").value(403))
                .andExpect(jsonPath("$.errors[0].code").value("PLATFORM_ADMIN_ACCESS_DENIED"));
    }
}
