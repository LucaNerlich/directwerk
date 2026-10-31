package de.pnnit.directwerk.controller.tenant;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.subscription.SubscriberEntitlementExplainService;
import de.pnnit.directwerk.subscription.SubscriberEntitlementExplainService.ContentCheckView;
import de.pnnit.directwerk.subscription.SubscriberEntitlementExplainService.SubjectSnapshotView;
import de.pnnit.directwerk.subscription.SubscriberEntitlementExplainService.SubscriberAccessExplainView;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.modules.subscription.service.EntitlementService.LevelEntitlement;
import de.pnnit.directwerk.modules.subscription.service.SubscriberDirectoryQueryService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class TenantSubscriberAccessControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SubscriberDirectoryQueryService subscriberDirectoryQueryService;

    @MockitoBean
    private SubscriberEntitlementExplainService subscriberEntitlementExplainService;

    @MockitoBean
    private ModuleGateService moduleGateService;

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
    void subscriberAccessReturnsSummaryWithoutCheck() throws Exception {
        when(subscriberEntitlementExplainService.explain(10L, 20L, null, null))
                .thenReturn(Optional.of(new SubscriberAccessExplainView(
                        20L,
                        List.of(new LevelEntitlement(1L, "supporter", "Supporter", 1)),
                        1,
                        List.of(),
                        null
                )));

        mockMvc.perform(get("/api/v1/tenant/subscribers/20/access"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(20))
                .andExpect(jsonPath("$.data.maxLevelSortOrder").value(1))
                .andExpect(jsonPath("$.data.activeLevels[0].slug").value("supporter"))
                .andExpect(jsonPath("$.data.check").isEmpty());

        verify(subscriberEntitlementExplainService).explain(10L, 20L, null, null);
        verify(moduleGateService).requireModules(List.of(SubscriptionModule.MODULE_KEY));
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void subscriberAccessReturnsEpisodeCheck() throws Exception {
        ContentCheckView check = new ContentCheckView(
                "EPISODE",
                55L,
                "Secret Show",
                "secret-show",
                false,
                "DENIED_LEVEL",
                new SubjectSnapshotView(false, 2, null, 30L, Set.of(40L), Set.of()),
                List.of()
        );
        when(subscriberEntitlementExplainService.explain(10L, 20L, 55L, null))
                .thenReturn(Optional.of(new SubscriberAccessExplainView(
                        20L,
                        List.of(new LevelEntitlement(1L, "supporter", "Supporter", 1)),
                        1,
                        List.of(),
                        check
                )));

        mockMvc.perform(get("/api/v1/tenant/subscribers/20/access").param("episodeId", "55"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.check.kind").value("EPISODE"))
                .andExpect(jsonPath("$.data.check.id").value(55))
                .andExpect(jsonPath("$.data.check.allowed").value(false))
                .andExpect(jsonPath("$.data.check.reason").value("DENIED_LEVEL"))
                .andExpect(jsonPath("$.data.check.subject.requiredLevelSortOrder").value(2));
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void subscriberAccessRejectsBothContentIds() throws Exception {
        mockMvc.perform(get("/api/v1/tenant/subscribers/20/access")
                        .param("episodeId", "55")
                        .param("articleId", "9"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("INVALID_CONTENT_CHECK"));
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void subscriberAccessReturns404WhenUserMissing() throws Exception {
        when(subscriberEntitlementExplainService.explain(10L, 99L, null, null))
                .thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/tenant/subscribers/99/access"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].code").value("USER_NOT_FOUND"));
    }
}
