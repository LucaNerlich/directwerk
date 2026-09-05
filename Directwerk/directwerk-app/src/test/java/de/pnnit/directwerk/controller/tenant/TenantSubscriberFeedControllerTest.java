package de.pnnit.directwerk.controller.tenant;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.service.SubscriberFeedService;
import de.pnnit.directwerk.modules.subscription.SubscriptionModule;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class TenantSubscriberFeedControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SubscriberFeedService subscriberFeedService;

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
    void listFeedsReturnsTenantFeedsWithUserEmail() throws Exception {
        SubscriberFeed feed = feed(42L, "alpha", "sub@example.test", false);
        when(subscriberFeedService.listTenantFeeds(10L)).thenReturn(List.of(feed));

        mockMvc.perform(get("/api/v1/tenant/subscriber-feeds"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(42))
                .andExpect(jsonPath("$.data[0].userId").value(7))
                .andExpect(jsonPath("$.data[0].userEmail").value("sub@example.test"))
                .andExpect(jsonPath("$.data[0].title").value("Mein Feed"))
                .andExpect(jsonPath("$.data[0].isDefault").value(false))
                .andExpect(jsonPath("$.data[0].enabled").value(true))
                .andExpect(jsonPath("$.data[0].formatIds").isArray());

        verify(subscriberFeedService).listTenantFeeds(10L);
        verify(moduleGateService).requireModule(SubscriptionModule.MODULE_KEY);
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void setEnabledDelegatesToServiceAndReturnsUpdatedView() throws Exception {
        SubscriberFeed feed = feed(42L, "alpha", "sub@example.test", false);
        feed.setEnabled(false);
        when(subscriberFeedService.setFeedEnabled(10L, 42L, false)).thenReturn(feed);

        mockMvc.perform(put("/api/v1/tenant/subscriber-feeds/42/enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(42))
                .andExpect(jsonPath("$.data.enabled").value(false));

        verify(subscriberFeedService).setFeedEnabled(10L, 42L, false);
        verify(moduleGateService).requireModule(SubscriptionModule.MODULE_KEY);
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void setEnabledRejectsMissingBody() throws Exception {
        mockMvc.perform(put("/api/v1/tenant/subscriber-feeds/42/enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    private static SubscriberFeed feed(Long id, String tenantSlug, String userEmail, boolean defaultFeed) {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug(tenantSlug);

        User user = new User();
        user.setId(7L);
        user.setEmail(userEmail);

        SubscriberFeed feed = new SubscriberFeed();
        feed.setId(id);
        feed.setTenant(tenant);
        feed.setUser(user);
        feed.setFeedToken("token-" + id);
        feed.setTitle("Mein Feed");
        feed.setDefaultFeed(defaultFeed);
        feed.setEnabled(true);
        feed.setCreatedAt(Instant.parse("2026-07-20T12:00:00Z"));
        feed.setUpdatedAt(Instant.parse("2026-07-20T12:00:00Z"));
        return feed;
    }
}
