package de.pnnit.directwerk.controller.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.audit.PlatformAuditActions;
import de.pnnit.directwerk.modules.core.entity.FeatureModule;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantModuleActivation;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.repository.FeatureModuleRepository;
import de.pnnit.directwerk.modules.core.repository.PlatformAuditEventRepository;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import java.util.List;
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

    @Autowired
    private PlatformAuditEventRepository platformAuditEventRepository;

    @Autowired
    private FeatureModuleRepository featureModuleRepository;

    @Autowired
    private TenantModuleActivationRepository tenantModuleActivationRepository;

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
    void getTenantReturnsDetailsWithoutModulePreset() throws Exception {
        mockMvc.perform(get("/api/v1/platform/tenants/{id}", tenant.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tenant.slug").value(tenant.getSlug()))
                .andExpect(jsonPath("$.data.episodeCount").value(0))
                .andExpect(jsonPath("$.data.subscriberCount").value(0));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void createTenantWithFullModulePresetPrimaryDomainAndAdminEmail() throws Exception {
        // This profile disables Flyway (H2 create-drop from JPA entities only), so the
        // feature_modules catalog rows Flyway normally seeds in production don't exist here —
        // seed the ones the FULL preset needs so applyPreset's catalog check has something to find.
        seedFeatureModuleCatalogForFullPreset();

        String uuid = UUID.randomUUID().toString().replace("-", "");
        String slug = "luca-test-" + uuid.substring(0, 12);
        String primaryDomain = "test-" + uuid.substring(0, 8) + ".localhost";
        String adminEmail = "test-admin-" + uuid.substring(0, 8) + "@example.com";
        String body = """
                {
                  "name": "Luca Test",
                  "slug": "%s",
                  "primaryDomain": "%s",
                  "modulePreset": "FULL",
                  "adminEmail": "%s",
                  "adminName": "Test Admin"
                }
                """.formatted(slug, primaryDomain, adminEmail);

        mockMvc.perform(post("/api/v1/platform/tenants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Luca Test"))
                .andExpect(jsonPath("$.data.slug").value(slug))
                .andExpect(jsonPath("$.data.adminInvitation.email").value(adminEmail))
                .andExpect(jsonPath("$.data.adminInvitation.status").value("INVITED"));

        Tenant created = tenantRepository.findBySlug(slug).orElseThrow();
        assertThat(tenantModuleActivationRepository.findByTenantIdAndActiveTrue(created.getId()))
                .extracting(TenantModuleActivation::getModuleKey)
                .containsExactlyInAnyOrder(
                        "DIGITAL_CONTENT", "SUBSCRIPTION", "EMAIL_NOTIFY",
                        "WHITELABEL", "PODCAST", "PODCAST_RSS");
        assertThat(platformAuditEventRepository.findAll()).anySatisfy(event -> {
            assertThat(event.getAction()).isEqualTo(PlatformAuditActions.TENANT_CREATED);
            assertThat(event.getTenantId()).isEqualTo(created.getId());
        });
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void createTenantReturnsConflictOnDuplicateSlug() throws Exception {
        String body = """
                {
                  "name": "Duplicate Slug Tenant",
                  "slug": "%s",
                  "modulePreset": "FULL",
                  "adminEmail": "dup-admin@example.com",
                  "adminName": "Dup Admin"
                }
                """.formatted(tenant.getSlug());

        mockMvc.perform(post("/api/v1/platform/tenants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].code").value("TENANT_SLUG_EXISTS"));
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

    private void seedFeatureModuleCatalogForFullPreset() {
        for (String key : List.of("DIGITAL_CONTENT", "SUBSCRIPTION", "EMAIL_NOTIFY", "WHITELABEL", "PODCAST", "PODCAST_RSS")) {
            if (featureModuleRepository.findByModuleKey(key).isPresent()) {
                continue;
            }
            FeatureModule module = new FeatureModule();
            module.setModuleKey(key);
            module.setName(key);
            module.setDependsOn(List.of());
            featureModuleRepository.save(module);
        }
    }
}
