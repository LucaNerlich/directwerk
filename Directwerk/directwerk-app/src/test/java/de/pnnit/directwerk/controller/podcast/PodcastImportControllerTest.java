package de.pnnit.directwerk.controller.podcast;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.pnnit.directwerk.api.MediaAssetViewMapper;
import de.pnnit.directwerk.api.PublicEpisodeViewMapper;
import de.pnnit.directwerk.api.dto.EpisodeView;
import de.pnnit.directwerk.api.dto.MediaAssetView;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.entity.AssetVisibility;
import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.podcast.entity.PodcastSeries;
import de.pnnit.directwerk.modules.podcast.service.PodcastImportService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
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
class PodcastImportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PodcastImportService podcastImportService;

    @MockitoBean
    private ModuleGateService moduleGateService;

    @MockitoBean
    private PublicEpisodeViewMapper publicEpisodeViewMapper;

    @MockitoBean
    private MediaAssetViewMapper mediaAssetViewMapper;

    @MockitoBean
    private MediaAssetQueryApi mediaAssetQueryApi;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(10L);
        doNothing().when(moduleGateService).requireModule(org.mockito.ArgumentMatchers.anyString());
    }

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void previewReturnsParsedFeed() throws Exception {
        when(podcastImportService.preview("https://example.com/feed.xml")).thenReturn(new PodcastImportService.Preview(
                "https://example.com/feed.xml",
                new PodcastImportService.PreviewChannel(
                        "Alpha Show",
                        "About",
                        "de",
                        "News",
                        "https://cdn.example.com/show.jpg",
                        "https://example.com",
                        "alpha-show"
                ),
                List.of(new PodcastImportService.PreviewEpisode(
                        "guid-1",
                        "Folge 1",
                        "Notes",
                        Instant.parse("2026-07-20T12:00:00Z"),
                        3600,
                        1,
                        "https://cdn.example.com/ep1.mp3",
                        "audio/mpeg",
                        1234L,
                        "https://cdn.example.com/ep1.jpg",
                        "folge-1",
                        null
                )),
                false
        ));

        mockMvc.perform(post("/api/v1/podcast/import/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"feedUrl\":\"https://example.com/feed.xml\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.channel.title").value("Alpha Show"))
                .andExpect(jsonPath("$.data.episodes[0].guid").value("guid-1"))
                .andExpect(jsonPath("$.data.episodes[0].audioUrl").value("https://cdn.example.com/ep1.mp3"));

        verify(podcastImportService).preview("https://example.com/feed.xml");
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void ingestAssetReturnsCreatedMedia() throws Exception {
        MediaAsset asset = new MediaAsset();
        asset.setId(9L);
        when(podcastImportService.ingestAsset(
                eq("https://cdn.example.com/show.jpg"),
                eq(AssetType.IMAGE),
                eq(AssetVisibility.PUBLIC),
                eq(null)
        )).thenReturn(asset);
        when(mediaAssetViewMapper.toView(asset)).thenReturn(new MediaAssetView(
                9L,
                "alpha/public/images/cover.jpg",
                "PUBLIC",
                "TENANT_PUBLIC",
                "IMAGE",
                "READY",
                "image/jpeg",
                100L,
                100L,
                "show.jpg",
                null,
                null,
                null,
                null,
                null,
                Instant.parse("2026-07-20T12:00:00Z"),
                Instant.parse("2026-07-20T12:00:00Z")
        ));

        mockMvc.perform(post("/api/v1/podcast/import/assets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sourceUrl": "https://cdn.example.com/show.jpg",
                                  "assetType": "IMAGE",
                                  "visibility": "PUBLIC"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(9));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void importEpisodeReturnsCreatedEpisode() throws Exception {
        Episode episode = episode();
        when(podcastImportService.importEpisode(any())).thenReturn(
                new PodcastImportService.ImportedEpisode(episode, false)
        );
        when(publicEpisodeViewMapper.toStudioView(episode)).thenReturn(new EpisodeView(
                5L,
                7L,
                "main-show",
                1,
                "folge-1",
                "Folge 1",
                "Notes",
                11L,
                12L,
                3600,
                "FREE",
                null,
                "DRAFT",
                true,
                null,
                null,
                List.of(),
                List.of(),
                null,
                Instant.parse("2026-07-20T12:00:00Z"),
                Instant.parse("2026-07-20T12:00:00Z")
        ));

        mockMvc.perform(post("/api/v1/podcast/import/episodes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "seriesId": 7,
                                  "feedUrl": "https://example.com/feed.xml",
                                  "guid": "guid-1",
                                  "slug": "folge-1",
                                  "title": "Folge 1",
                                  "audioUrl": "https://cdn.example.com/ep1.mp3",
                                  "imageUrl": "https://cdn.example.com/ep1.jpg"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.alreadyImported").value(false))
                .andExpect(jsonPath("$.data.episode.id").value(5));
    }

    @Test
    @WithMockUser(roles = "EDITOR")
    void getIngestAssetFromAnotherTenantReturnsNotFound() throws Exception {
        Tenant foreignTenant = new Tenant();
        foreignTenant.setId(11L);
        MediaAsset foreignAsset = new MediaAsset();
        foreignAsset.setId(99L);
        foreignAsset.setTenant(foreignTenant);
        when(mediaAssetQueryApi.findById(99L)).thenReturn(Optional.of(foreignAsset));

        mockMvc.perform(get("/api/v1/podcast/import/assets/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].code").value("MEDIA_ASSET_NOT_FOUND"));
    }

    private static Episode episode() {
        Tenant tenant = new Tenant();
        tenant.setId(10L);
        PodcastSeries series = new PodcastSeries();
        series.setId(7L);
        series.setSlug("main-show");
        Episode episode = new Episode();
        episode.setId(5L);
        episode.setTenant(tenant);
        episode.setSeries(series);
        episode.setSlug("folge-1");
        episode.setTitle("Folge 1");
        episode.setStatus(EpisodeStatus.DRAFT);
        return episode;
    }
}
