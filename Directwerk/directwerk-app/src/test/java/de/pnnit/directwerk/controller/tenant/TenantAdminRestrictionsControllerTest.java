package de.pnnit.directwerk.controller.tenant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.authorization.ContentEntityType;
import de.pnnit.directwerk.modules.core.authorization.ContentOperation;
import de.pnnit.directwerk.modules.core.authorization.EffectiveAccess;
import de.pnnit.directwerk.modules.core.authorization.RestrictionScope;
import de.pnnit.directwerk.modules.core.entity.MembershipPermissionOverride;
import de.pnnit.directwerk.modules.core.service.MembershipPermissionService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class TenantAdminRestrictionsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MembershipPermissionService membershipPermissionService;

    @DynamicPropertySource
    static void registerEphemeralSecrets(DynamicPropertyRegistry registry) {
        String platformClientSecret = "test-platform-" + UUID.randomUUID();
        String tenantClientSecret = "test-tenant-" + UUID.randomUUID();
        registry.add("directwerk.security.oauth2.platform-client-secret", () -> platformClientSecret);
        registry.add("directwerk.security.oauth2.tenant-client-secret", () -> tenantClientSecret);
    }

    @BeforeEach
    void setUpTenantContext() {
        TenantContext.setTenantId(10L);
    }

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void listRestrictionsReturnsMemberRows() throws Exception {
        when(membershipPermissionService.listForUser(10L, 5L)).thenReturn(List.of(
                override(ContentEntityType.EPISODE, ContentOperation.PUBLISH, RestrictionScope.DENY)));

        mockMvc.perform(get("/api/v1/tenant/users/5/restrictions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].entityType").value("EPISODE"))
                .andExpect(jsonPath("$.data[0].operation").value("PUBLISH"))
                .andExpect(jsonPath("$.data[0].scope").value("DENY"));

        verify(membershipPermissionService).listForUser(10L, 5L);
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void replaceRestrictionsPersistsMappedInputs() throws Exception {
        when(membershipPermissionService.replaceForUser(eq(10L), eq(5L), anyList()))
                .thenReturn(List.of(
                        override(ContentEntityType.ARTICLE, ContentOperation.DELETE, RestrictionScope.OTHERS_ONLY)));

        mockMvc.perform(put("/api/v1/tenant/users/5/restrictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"restrictions": [
                                  {"entityType": "ARTICLE", "operation": "DELETE", "scope": "OTHERS_ONLY"}
                                ]}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].entityType").value("ARTICLE"))
                .andExpect(jsonPath("$.data[0].scope").value("OTHERS_ONLY"));

        verify(membershipPermissionService).replaceForUser(eq(10L), eq(5L), anyList());
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void replaceRestrictionsRejectsUnknownEnumValues() throws Exception {
        mockMvc.perform(put("/api/v1/tenant/users/5/restrictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"restrictions": [
                                  {"entityType": "EPISODE", "operation": "FLY", "scope": "DENY"}
                                ]}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void effectiveRightsReturnsServerResolvedMatrix() throws Exception {
        Map<ContentEntityType, Map<ContentOperation, EffectiveAccess>> effective =
                new EnumMap<>(ContentEntityType.class);
        Map<ContentOperation, EffectiveAccess> episode = new EnumMap<>(ContentOperation.class);
        episode.put(ContentOperation.PUBLISH, EffectiveAccess.DENIED);
        effective.put(ContentEntityType.EPISODE, episode);
        when(membershipPermissionService.effectiveRightsForMember(10L, 5L)).thenReturn(
                new MembershipPermissionService.MemberRights(
                        5L, List.of("EDITOR"), List.of(), effective));

        mockMvc.perform(get("/api/v1/tenant/users/5/effective-rights"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(5))
                .andExpect(jsonPath("$.data.roles[0]").value("EDITOR"))
                .andExpect(jsonPath("$.data.effective.EPISODE.PUBLISH").value("DENIED"));

        verify(membershipPermissionService).effectiveRightsForMember(10L, 5L);
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void restrictionsRequireTenantAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/tenant/users/5/restrictions"))
                .andExpect(status().isForbidden());
    }

    private static MembershipPermissionOverride override(
            ContentEntityType entity, ContentOperation operation, RestrictionScope scope) {
        MembershipPermissionOverride override = new MembershipPermissionOverride();
        override.setEntityType(entity);
        override.setOperation(operation);
        override.setScope(scope);
        return override;
    }
}
