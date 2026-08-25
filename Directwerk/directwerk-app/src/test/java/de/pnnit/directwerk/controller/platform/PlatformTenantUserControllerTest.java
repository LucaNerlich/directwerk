package de.pnnit.directwerk.controller.platform;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.entity.Role;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.TenantMembership;
import de.pnnit.directwerk.modules.core.entity.TenantStatus;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import java.util.EnumSet;
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

/**
 * The deactivate/reactivate endpoints are additionally covered end-to-end (real
 * Postgres/Testcontainers and signed JWTs) by {@code MembershipDeactivationFullStackIT}. This class
 * follows the lighter {@link PlatformTenantControllerTest} shape ({@code @SpringBootTest}
 * + {@code @AutoConfigureMockMvc} + H2 {@code test} profile + {@code @WithMockUser}) because
 * role-change coverage doesn't need real JWTs or the servlet-layer tenant filter: this controller
 * lives entirely under the platform-scoped {@code /api/v1/platform/**} path, where
 * {@code TenantContextFilter} clears tenant context regardless.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PlatformTenantUserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TenantMembershipRepository tenantMembershipRepository;

    private Long tenantId;
    private Long editorUserId;

    @DynamicPropertySource
    static void registerEphemeralSecrets(DynamicPropertyRegistry registry) {
        String platformClientSecret = "test-platform-" + UUID.randomUUID();
        String tenantClientSecret = "test-tenant-" + UUID.randomUUID();
        registry.add("directwerk.security.platform-client-secret", () -> platformClientSecret);
        registry.add("directwerk.security.tenant-client-secret", () -> tenantClientSecret);
    }

    @BeforeEach
    void seedTenantAndEditor() {
        Tenant tenant = new Tenant();
        tenant.setSlug("acme-" + UUID.randomUUID().toString().substring(0, 8));
        tenant.setName("Acme");
        tenant.setStatus(TenantStatus.ACTIVE);
        tenant = tenantRepository.save(tenant);
        tenantId = tenant.getId();

        User editor = new User();
        editor.setEmail("editor-" + UUID.randomUUID() + "@example.test");
        editor.setName("Editor User");
        editor = userRepository.save(editor);
        editorUserId = editor.getId();

        TenantMembership membership = new TenantMembership();
        membership.setUser(editor);
        membership.setTenant(tenant);
        membership.setRoles(EnumSet.of(Role.EDITOR));
        membership.setStatus(MembershipStatus.ACTIVE);
        tenantMembershipRepository.save(membership);
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void updateUserRoleReturnsUpdatedMembership() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{tenantId}/users/{userId}", tenantId, editorUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"TENANT_ADMIN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roles[0]").value("TENANT_ADMIN"));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void updateUserRoleRejectsInvalidRole() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{tenantId}/users/{userId}", tenantId, editorUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"NOT_A_ROLE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));
    }

    @Test
    @WithMockUser(roles = "PLATFORM_ADMIN")
    void updateUserRoleRejectsBlankRole() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{tenantId}/users/{userId}", tenantId, editorUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void updateUserRoleRejectsNonPlatformUser() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{tenantId}/users/{userId}", tenantId, editorUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"TENANT_ADMIN\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateUserRoleRejectsAnonymous() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{tenantId}/users/{userId}", tenantId, editorUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"TENANT_ADMIN\"}"))
                .andExpect(status().isUnauthorized());
    }
}
