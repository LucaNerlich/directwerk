package de.pnnit.directwerk.controller.podcast;

import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.api.PublicEpisodeViewMapper;
import de.pnnit.directwerk.api.dto.EpisodeView;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.exception.EpisodeNotFoundException;
import de.pnnit.directwerk.modules.podcast.service.EpisodeService;
import de.pnnit.directwerk.modules.podcast.service.PublicationWorkflowService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
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

    @Test
    @WithMockUser(roles = "EDITOR")
    void bulkPublishReturnsViews() throws Exception {
        Episode first = new Episode();
        first.setId(7L);
        Episode second = new Episode();
        second.setId(8L);
        when(publicationWorkflowService.bulkPublish(
                ArgumentMatchers.eq(10L),
                ArgumentMatchers.eq(List.of(7L, 8L)),
                ArgumentMatchers.eq(false),
                ArgumentMatchers.isNull()))
                .thenReturn(List.of(first, second));
        when(publicEpisodeViewMapper.toStudioView(ArgumentMatchers.any(Episode.class)))
                .thenAnswer(invocation -> episodeView(((Episode) invocation.getArgument(0)).getId()));

        mockMvc.perform(post("/api/v1/episodes/bulk/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7,8],\"notifySubscribers\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(7))
                .andExpect(jsonPath("$.data[1].id").value(8));

        verify(publicationWorkflowService).bulkPublish(10L, List.of(7L, 8L), false, null);
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void bulkPublishRejectsEmptyIds() throws Exception {
        mockMvc.perform(post("/api/v1/episodes/bulk/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("VALIDATION_ERROR"));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void bulkPublishReturnsNotFoundForUnknownId() throws Exception {
        when(publicationWorkflowService.bulkPublish(
                ArgumentMatchers.eq(10L),
                ArgumentMatchers.eq(List.of(7L, 8L)),
                ArgumentMatchers.anyBoolean(),
                ArgumentMatchers.isNull()))
                .thenThrow(new EpisodeNotFoundException(8L));

        mockMvc.perform(post("/api/v1/episodes/bulk/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7,8]}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].code").value("EPISODE_NOT_FOUND"));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void bulkUnpublishReturnsViews() throws Exception {
        Episode episode = new Episode();
        episode.setId(7L);
        when(publicationWorkflowService.bulkUnpublish(10L, List.of(7L)))
                .thenReturn(List.of(episode));
        when(publicEpisodeViewMapper.toStudioView(episode)).thenReturn(episodeView(7L));

        mockMvc.perform(post("/api/v1/episodes/bulk/unpublish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        verify(publicationWorkflowService).bulkUnpublish(10L, List.of(7L));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void bulkDeleteReturnsDeletedIds() throws Exception {
        when(episodeService.bulkDelete(10L, List.of(7L, 8L))).thenReturn(List.of(7L, 8L));

        mockMvc.perform(post("/api/v1/episodes/bulk/delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7,8]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deletedIds[0]").value(7))
                .andExpect(jsonPath("$.data.deletedIds[1]").value(8));

        verify(episodeService).bulkDelete(10L, List.of(7L, 8L));
    }

    @Test
    @WithMockUser(roles = "SUBSCRIBER")
    void bulkDeleteRejectsSubscriberRole() throws Exception {
        mockMvc.perform(post("/api/v1/episodes/bulk/delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[7]}"))
                .andExpect(status().isForbidden());
    }

    private static EpisodeView episodeView(Long id) {
        return new EpisodeView(
                id, 20L, "main", 1, "episode-" + id, "Episode " + id, null,
                null, null, null, null, "FREE", null, "PUBLISHED", false,
                null, null, List.of(), List.of(), null, null, null);
    }
}
