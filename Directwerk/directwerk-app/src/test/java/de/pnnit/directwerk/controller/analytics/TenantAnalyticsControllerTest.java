package de.pnnit.directwerk.controller.analytics;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.analytics.AnalyticsQueryService;
import de.pnnit.directwerk.analytics.AnalyticsRange;
import de.pnnit.directwerk.modules.core.AnalyticsModule;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
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
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class TenantAnalyticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AnalyticsQueryService analyticsQueryService;

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
    void returnsStatsForKnownRange() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        when(analyticsQueryService.query(eq(10L), eq(AnalyticsRange.SEVEN_DAYS))).thenReturn(
                new AnalyticsQueryService.StatsView(
                        "7d",
                        1000L,
                        2000L,
                        mapper.readTree("{\"pageviews\":5,\"visitors\":4,\"visits\":3,\"bounces\":1}"),
                        mapper.readTree("{\"pageviews\":[],\"sessions\":[]}")
                )
        );

        mockMvc.perform(get("/api/v1/tenant/analytics/stats/7d"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.range").value("7d"))
                .andExpect(jsonPath("$.data.stats.pageviews").value(5));

        verify(moduleGateService).requireModules(List.of(AnalyticsModule.KEY));
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void rejectsUnknownRange() throws Exception {
        mockMvc.perform(get("/api/v1/tenant/analytics/stats/13d"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("ANALYTICS_RANGE_INVALID"));
    }
}
