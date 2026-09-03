package de.pnnit.directwerk.controller.podcast;

import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.api.PublicEpisodeViewMapper;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.service.EpisodeService;
import de.pnnit.directwerk.modules.podcast.service.PublicationWorkflowService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class EpisodeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EpisodeService episodeService;

    @MockitoBean
    private PublicationWorkflowService publicationWorkflowService;

    @MockitoBean
    private PublicEpisodeViewMapper publicEpisodeViewMapper;

    @MockitoBean
    private ModuleGateService moduleGateService;

    @DynamicPropertySource
    static void registerEphemeralSecrets(DynamicPropertyRegistry registry) {
        String platformClientSecret = "test-platform-" + UUID.randomUUID();
        String tenantClientSecret = "test-tenant-" + UUID.randomUUID();
        registry.add("directwerk.security.platform-client-secret", () -> platformClientSecret);
        registry.add("directwerk.security.tenant-client-secret", () -> tenantClientSecret);
    }

    @BeforeEach
    void setUpTenantContext() {
        TenantContext.setTenantId(10L);
        doNothing().when(moduleGateService).requireModule(ArgumentMatchers.anyString());
    }

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void deleteEpisodeReturnsNoContent() throws Exception {
        doNothing().when(episodeService).deleteEpisode(10L, 7L);

        mockMvc.perform(delete("/api/v1/episodes/{episodeId}", 7L))
                .andExpect(status().isNoContent());

        verify(episodeService).deleteEpisode(10L, 7L);
    }

    @Test
    @WithMockUser(roles = "TENANT_ADMIN")
    void deleteEpisodeReturnsNotFoundForForeignTenantItem() throws Exception {
        doThrow(new EpisodeNotFoundException(7L)).when(episodeService).deleteEpisode(10L, 7L);

        mockMvc.perform(delete("/api/v1/episodes/{episodeId}", 7L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].code").value("EPISODE_NOT_FOUND"));
    }

    @Test
    @WithMockUser(roles = "SUBSCRIBER")
    void deleteEpisodeRejectsSubscriberRole() throws Exception {
        mockMvc.perform(delete("/api/v1/episodes/{episodeId}", 7L))
                .andExpect(status().isForbidden());
    }
}
