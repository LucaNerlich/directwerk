package de.pnnit.directwerk.controller.platform;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PlatformTenantControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TenantRepository tenantRepository;

    private Tenant tenant;
    private Tenant otherTenant;

    @DynamicPropertySource
    static void registerEphemeralSecrets(DynamicPropertyRegistry registry) {
        String platformClientSecret = "test-platform-" + UUID.randomUUID();
        String tenantClientSecret = "test-tenant-" + UUID.randomUUID();
        registry.add("directwerk.security.platform-client-secret", () -> platformClientSecret);
        registry.add("directwerk.security.tenant-client-secret", () -> tenantClientSecret);
    }

    @BeforeEach
    void seedTenants() {
        tenant = new Tenant();
        tenant.setSlug("acme-" + UUID.randomUUID().toString().substring(0, 8));
        tenant.setName("Acme");
        tenant.setStatus(TenantStatus.ACTIVE);
        tenant = tenantRepository.save(tenant);

        otherTenant = new Tenant();
        otherTenant.setSlug("globex-" + UUID.randomUUID().toString().substring(0, 8));
        otherTenant.setName("Globex");
        otherTenant.setStatus(TenantStatus.ACTIVE);
        otherTenant = tenantRepository.save(otherTenant);
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void updateTenantReturnsUpdatedDetails() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{id}", tenant.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Renamed Tenant\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Renamed Tenant"));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void updateTenantReturnsConflictOnDuplicateSlug() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{id}", otherTenant.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"" + tenant.getSlug() + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].code").value("TENANT_SLUG_EXISTS"));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void updateTenantAllowsOwnCurrentSlug() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{id}", tenant.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Renamed Tenant\",\"slug\":\"" + tenant.getSlug() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(tenant.getSlug()));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void updateTenantWithBlankSlugLeavesSlugUnchanged() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{id}", tenant.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(tenant.getSlug()));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void updateTenantRejectsInvalidSlugPattern() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{id}", tenant.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"Invalid Slug!\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void updateTenantRejectsNameExceedingMaxLength() throws Exception {
        String tooLongName = "a".repeat(256);
        mockMvc.perform(patch("/api/v1/platform/tenants/{id}", tenant.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + tooLongName + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void updateTenantRejectsNonPlatformUser() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{id}", tenant.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Renamed Tenant\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateTenantRejectsAnonymous() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{id}", tenant.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Renamed Tenant\"}"))
                .andExpect(status().isUnauthorized());
    }
}
