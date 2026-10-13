package de.pnnit.directwerk.controller.platform;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import de.pnnit.directwerk.testsupport.PlatformAdminApiTestSupport;
import java.util.EnumSet;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

/**
 * Platform-admin role-change and effective-rights coverage. Authenticates as a real platform admin
 * (signed JWT + {@code platform_admins} row) through {@link PlatformAdminApiTestSupport}, because
 * {@code PlatformAdminGuardFilter} re-checks the grant against the DB on every request. The
 * deactivate/reactivate endpoints are additionally covered end-to-end (real Postgres/Testcontainers
 * and signed JWTs) by {@code MembershipDeactivationFullStackIT}.
 */
class PlatformTenantUserControllerTest extends PlatformAdminApiTestSupport {

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TenantMembershipRepository tenantMembershipRepository;

    private Long tenantId;
    private Long editorUserId;

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
    void updateUserRoleReturnsUpdatedMembership() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{tenantId}/users/{userId}", tenantId, editorUserId)
                        .with(asPlatformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"TENANT_ADMIN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roles[0]").value("TENANT_ADMIN"));
    }

    @Test
    void updateUserRoleRejectsInvalidRole() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{tenantId}/users/{userId}", tenantId, editorUserId)
                        .with(asPlatformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"NOT_A_ROLE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));
    }

    @Test
    void updateUserRoleRejectsBlankRole() throws Exception {
        mockMvc.perform(patch("/api/v1/platform/tenants/{tenantId}/users/{userId}", tenantId, editorUserId)
                        .with(asPlatformAdmin())
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

    @Test
    void effectiveRightsResolveUnrestrictedEditorMatrix() throws Exception {
        mockMvc.perform(get("/api/v1/platform/tenants/{tenantId}/users/{userId}/effective-rights", tenantId, editorUserId)
                        .with(asPlatformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(editorUserId))
                .andExpect(jsonPath("$.data.roles[0]").value("EDITOR"))
                .andExpect(jsonPath("$.data.restrictions").isArray())
                .andExpect(jsonPath("$.data.effective.EPISODE.DELETE").value("FULL"))
                .andExpect(jsonPath("$.data.effective.MEDIA_ASSET.MOVE").value("FULL"));
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void effectiveRightsRejectNonPlatformUser() throws Exception {
        mockMvc.perform(get("/api/v1/platform/tenants/{tenantId}/users/{userId}/effective-rights", tenantId, editorUserId))
                .andExpect(status().isForbidden());
    }
}
