package de.pnnit.directwerk.controller.podcast;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.core.service.TenantLookupService;
import de.pnnit.directwerk.modules.podcast.PodcastRssModule;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.entity.SeriesStatus;
import de.pnnit.directwerk.modules.podcast.service.SeriesService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.List;
import java.util.Set;
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
class SeriesControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SeriesService seriesService;

    @MockitoBean
    private ModuleGateService moduleGateService;

    @MockitoBean
    private TenantLookupService tenantLookupService;

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
    }

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void listSeriesReturnsTenantSeriesForEditor() throws Exception {
        PodcastSeries series = series(7L);
        when(seriesService.listSeries(10L, false)).thenReturn(List.of(series));

        mockMvc.perform(get("/api/v1/series"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(7))
                .andExpect(jsonPath("$.data[0].slug").value("main-show"))
                .andExpect(jsonPath("$.data[0].title").value("Main Show"));

        verify(seriesService).listSeries(10L, false);
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void listSeriesIncludesRssUrlWhenPodcastRssModuleEnabled() throws Exception {
        PodcastSeries series = series(7L);
        when(seriesService.listSeries(10L, false)).thenReturn(List.of(series));
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(PodcastRssModule.KEY));
        when(tenantLookupService.requireTenant(10L)).thenReturn(series.getTenant());

        mockMvc.perform(get("/api/v1/series"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].rssUrl").value("http://localhost/feeds/alpha/main-show.xml"));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void listSeriesRssUrlIsNullWhenPodcastRssModuleDisabled() throws Exception {
        PodcastSeries series = series(7L);
        when(seriesService.listSeries(10L, false)).thenReturn(List.of(series));
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of());

        mockMvc.perform(get("/api/v1/series"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].rssUrl").doesNotExist());

        verify(tenantLookupService, never()).requireTenant(any());
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void createSeriesReturnsCreatedSeries() throws Exception {
        PodcastSeries series = series(8L);
        when(seriesService.createSeries(
                eq(10L),
                eq("main-show"),
                eq("Main Show"),
                eq("<p>About</p>"),
                eq(null),
                eq("de"),
                eq("News"),
                eq(null)
        )).thenReturn(series);

        mockMvc.perform(post("/api/v1/series")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slug": "main-show",
                                  "title": "Main Show",
                                  "description": "<p>About</p>",
                                  "language": "de",
                                  "itunesCategory": "News"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(8))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));

        verify(seriesService).createSeries(
                eq(10L),
                eq("main-show"),
                eq("Main Show"),
                eq("<p>About</p>"),
                eq(null),
                eq("de"),
                eq("News"),
                eq(null)
        );
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void createSeriesIncludesRssUrlWhenPodcastRssModuleEnabled() throws Exception {
        PodcastSeries series = series(8L);
        when(seriesService.createSeries(
                eq(10L), eq("main-show"), eq("Main Show"), eq("<p>About</p>"), eq(null), eq("de"), eq("News"), eq(null)
        )).thenReturn(series);
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(PodcastRssModule.KEY));
        when(tenantLookupService.requireTenant(10L)).thenReturn(series.getTenant());

        mockMvc.perform(post("/api/v1/series")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slug": "main-show",
                                  "title": "Main Show",
                                  "description": "<p>About</p>",
                                  "language": "de",
                                  "itunesCategory": "News"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.rssUrl").value("http://localhost/feeds/alpha/main-show.xml"));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void createSeriesRssUrlIsNullWhenPodcastRssModuleDisabled() throws Exception {
        PodcastSeries series = series(8L);
        when(seriesService.createSeries(
                eq(10L), eq("main-show"), eq("Main Show"), eq("<p>About</p>"), eq(null), eq("de"), eq("News"), eq(null)
        )).thenReturn(series);
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of());

        mockMvc.perform(post("/api/v1/series")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slug": "main-show",
                                  "title": "Main Show",
                                  "description": "<p>About</p>",
                                  "language": "de",
                                  "itunesCategory": "News"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.rssUrl").doesNotExist());

        verify(tenantLookupService, never()).requireTenant(any());
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void createSeriesReturnsConflictOnDuplicateSlug() throws Exception {
        when(seriesService.createSeries(
                eq(10L), eq("main-show"), eq("Main Show"), eq(null), eq(null), eq(null), eq(null), eq(null)
        )).thenThrow(new IllegalStateException("Series slug already exists: main-show"));

        mockMvc.perform(post("/api/v1/series")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slug": "main-show",
                                  "title": "Main Show"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].code").value("SERIES_SLUG_EXISTS"));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void updateSeriesIncludesRssUrlWhenPodcastRssModuleEnabled() throws Exception {
        PodcastSeries series = series(9L);
        when(seriesService.updateSeries(
                eq(10L), eq(9L), eq(null), eq("Renamed Show"), eq(null), eq(null), eq(null), eq(null), eq(null), eq(null)
        )).thenReturn(series);
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(PodcastRssModule.KEY));
        when(tenantLookupService.requireTenant(10L)).thenReturn(series.getTenant());

        mockMvc.perform(put("/api/v1/series/{seriesId}", 9L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Renamed Show"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rssUrl").value("http://localhost/feeds/alpha/main-show.xml"));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void updateSeriesRssUrlIsNullWhenPodcastRssModuleDisabled() throws Exception {
        PodcastSeries series = series(9L);
        when(seriesService.updateSeries(
                eq(10L), eq(9L), eq(null), eq("Renamed Show"), eq(null), eq(null), eq(null), eq(null), eq(null), eq(null)
        )).thenReturn(series);
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of());

        mockMvc.perform(put("/api/v1/series/{seriesId}", 9L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Renamed Show"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rssUrl").doesNotExist());
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void updateSeriesReturnsConflictOnDuplicateSlug() throws Exception {
        when(seriesService.updateSeries(
                eq(10L), eq(9L), eq("taken-slug"), eq(null), eq(null), eq(null), eq(null), eq(null), eq(null), eq(null)
        )).thenThrow(new IllegalStateException("Series slug already exists: taken-slug"));

        mockMvc.perform(put("/api/v1/series/{seriesId}", 9L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slug": "taken-slug"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].code").value("SERIES_SLUG_EXISTS"));
    }

    @Test
    @WithMockUser(roles = "SUBSCRIBER")
    void listSeriesRejectsSubscriberRole() throws Exception {
        mockMvc.perform(get("/api/v1/series"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void getSeriesIncludesRssUrlWhenPodcastRssModuleEnabled() throws Exception {
        PodcastSeries series = series(9L);
        when(seriesService.requireSeries(10L, 9L)).thenReturn(series);
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of(PodcastRssModule.KEY));
        when(tenantLookupService.requireTenant(10L)).thenReturn(series.getTenant());

        mockMvc.perform(get("/api/v1/series/{seriesId}", 9L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rssUrl").value("http://localhost/feeds/alpha/main-show.xml"));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void getSeriesRssUrlIsNullWhenPodcastRssModuleDisabled() throws Exception {
        PodcastSeries series = series(9L);
        when(seriesService.requireSeries(10L, 9L)).thenReturn(series);
        when(moduleGateService.enabledModuleKeys(10L)).thenReturn(Set.of());

        mockMvc.perform(get("/api/v1/series/{seriesId}", 9L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rssUrl").doesNotExist());
    }

    private static PodcastSeries series(Long id) {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        tenant.setSlug("alpha");

        PodcastSeries series = new PodcastSeries();
        series.setId(id);
        series.setTenant(tenant);
        series.setSlug("main-show");
        series.setTitle("Main Show");
        series.setDescription("<p>About</p>");
        series.setLanguage("de");
        series.setItunesCategory("News");
        series.setStatus(SeriesStatus.DRAFT);
        series.setCreatedAt(Instant.parse("2026-07-20T12:00:00Z"));
        series.setUpdatedAt(Instant.parse("2026-07-20T12:00:00Z"));
        return series;
    }
}
