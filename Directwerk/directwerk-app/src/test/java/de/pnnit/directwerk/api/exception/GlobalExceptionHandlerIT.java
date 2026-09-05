package de.pnnit.directwerk.api.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Guards the API-wide error contract: every failure — unknown routes, wrong methods, malformed
 * bodies, type mismatches, validation failures, missing auth, insufficient roles — must leave the
 * API as the standard {@code Response<T>} envelope ({@code statusCode}/{@code statusMessage} plus
 * an {@code errors} array carrying machine-readable {@code code}s), never as a Spring default
 * body or an HTML error page.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GlobalExceptionHandlerIT {

    @Autowired
    private MockMvc mockMvc;

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
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void unknownRouteReturnsNotFoundEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/platform/no-such-route"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.statusCode").value(404))
                .andExpect(jsonPath("$.statusMessage").value("NOT_FOUND"))
                .andExpect(jsonPath("$.errors[0].code").value("NOT_FOUND"));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void wrongMethodReturnsMethodNotAllowedEnvelope() throws Exception {
        mockMvc.perform(post("/api/v1/platform/overview"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.statusCode").value(405))
                .andExpect(jsonPath("$.errors[0].code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void malformedJsonReturnsBadRequestEnvelope() throws Exception {
        mockMvc.perform(post("/api/v1/platform/tenants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": broken"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.errors[0].code").value("MESSAGE_NOT_READABLE"));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void pathTypeMismatchReturnsValidationEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/platform/tenants/not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void beanValidationFailureUsesCodeAsStatusMessage() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{id}", tenant.getId())
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
    @WithMockUser(roles = "TENANT_ADMIN")
    void insufficientRoleReturnsAccessDeniedEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/platform/tenants"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.statusCode").value(403))
                .andExpect(jsonPath("$.errors[0].code").value("ACCESS_DENIED"));
    }
}
