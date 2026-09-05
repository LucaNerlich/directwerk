package de.pnnit.directwerk.controller.podcast;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.api.MediaAssetViewMapper;
import de.pnnit.directwerk.api.PublicEpisodeViewMapper;
import de.pnnit.directwerk.modules.core.service.UserAccountService;
import de.pnnit.directwerk.modules.digital.api.MediaAssetQueryApi;
import de.pnnit.directwerk.modules.podcast.service.PodcastImportService;
import de.pnnit.directwerk.modules.podcast.exception.RssImportException;
import de.pnnit.directwerk.modules.queue.JobEnqueueMetadata;
import de.pnnit.directwerk.modules.queue.QueueJob;
import de.pnnit.directwerk.modules.queue.QueueNames;
import de.pnnit.directwerk.modules.queue.QueueService;
import de.pnnit.directwerk.multitenancy.TenantContext;
import de.pnnit.directwerk.security.DirectwerkUserPrincipal;
import de.pnnit.directwerk.security.RoleConstants;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class PodcastImportBulkControllerTest {

    @Mock
    private PodcastImportService podcastImportService;
    @Mock
    private PublicEpisodeViewMapper publicEpisodeViewMapper;
    @Mock
    private MediaAssetViewMapper mediaAssetViewMapper;
    @Mock
    private MediaAssetQueryApi mediaAssetQueryApi;
    @Mock
    private QueueService queueService;
    @Mock
    private UserAccountService userAccountService;

    private PodcastImportController controller;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(10L);
        controller = new PodcastImportController(
                podcastImportService,
                publicEpisodeViewMapper,
                mediaAssetViewMapper,
                mediaAssetQueryApi,
                queueService,
                new ObjectMapper(),
                userAccountService
        );
    }

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void bulkEnqueuesJobWithPreviewCountsAndEditorEmail() {
        when(podcastImportService.preview("https://example.com/feed.xml")).thenReturn(new PodcastImportService.Preview(
                "https://example.com/feed.xml",
                new PodcastImportService.PreviewChannel(
                        "Show", "About", "de", "News", null, null, "show"),
                List.of(
                        episode("guid-1", null),
                        episode("guid-2", 44L)
                ),
                false
        ));
        when(userAccountService.findAccount(20L)).thenReturn(Optional.of(
                new UserAccountService.AccountView(7L, "editor@example.test", "Eddie")));
        UUID jobId = UUID.randomUUID();
        QueueJob queued = org.mockito.Mockito.mock(QueueJob.class);
        when(queued.id()).thenReturn(jobId);
        when(queueService.enqueue(
                any(String.class),
                any(JsonNode.class),
                eq(0),
                any(),
                any(),
                any(JobEnqueueMetadata.class)
        )).thenReturn(queued);

        var response = controller.importBulk(
                new PodcastImportController.BulkImportRequest(
                        "https://example.com/feed.xml",
                        3L,
                        Set.of(11L),
                        null,
                        null,
                        true,
                        true
                ),
                new DirectwerkUserPrincipal(
                        20L,
                        "editor@example.test",
                        "hash",
                        10L,
                        List.of(new SimpleGrantedAuthority(RoleConstants.EDITOR)))
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data().jobId()).isEqualTo(jobId.toString());
        assertThat(response.getBody().data().totalEpisodes()).isEqualTo(2);
        assertThat(response.getBody().data().alreadyImported()).isEqualTo(1);
        assertThat(response.getBody().data().notifyEmail()).isEqualTo("editor@example.test");

        var payload = ArgumentCaptor.forClass(JsonNode.class);
        var metadata = ArgumentCaptor.forClass(JobEnqueueMetadata.class);
        verify(queueService).enqueue(
                eq(QueueNames.RSS_BULK_IMPORT),
                payload.capture(),
                eq(0),
                eq(null),
                eq(null),
                metadata.capture()
        );
        assertThat(payload.getValue().get("seriesId").asLong()).isEqualTo(3L);
        assertThat(payload.getValue().get("notifyEmail").asText()).isEqualTo("editor@example.test");
        assertThat(metadata.getValue().tenantId()).isEqualTo(10L);
        assertThat(metadata.getValue().correlationId()).startsWith("rss-bulk-import-10-3-");
    }

    @Test
    void bulkReturnsNotFoundForUnknownAccount() {
        when(userAccountService.findAccount(20L)).thenReturn(Optional.empty());

        var response = controller.importBulk(
                new PodcastImportController.BulkImportRequest(
                        "https://example.com/feed.xml",
                        3L,
                        null,
                        null,
                        null,
                        null,
                        null
                ),
                new DirectwerkUserPrincipal(
                        20L,
                        "editor@example.test",
                        "hash",
                        10L,
                        List.of(new SimpleGrantedAuthority(RoleConstants.EDITOR)))
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void bulkRejectsTruncatedPreviewBeforeEnqueueing() {
        when(userAccountService.findAccount(20L)).thenReturn(Optional.of(
                new UserAccountService.AccountView(7L, "editor@example.test", "Eddie")));
        when(podcastImportService.preview("https://example.com/feed.xml")).thenReturn(new PodcastImportService.Preview(
                "https://example.com/feed.xml",
                new PodcastImportService.PreviewChannel(
                        "Show", "About", "de", "News", null, null, "show"),
                List.of(episode("guid-1", null)),
                true
        ));

        assertThatThrownBy(() -> controller.importBulk(
                new PodcastImportController.BulkImportRequest(
                        "https://example.com/feed.xml",
                        3L,
                        Set.of(),
                        null,
                        null,
                        true,
                        true
                ),
                new DirectwerkUserPrincipal(
                        20L,
                        "editor@example.test",
                        "hash",
                        10L,
                        List.of(new SimpleGrantedAuthority(RoleConstants.EDITOR)))
        ))
                .isInstanceOf(RssImportException.class)
                .hasMessageContaining("truncated");

        verify(queueService, never()).enqueue(any(), any(), any(Integer.class), any(), any(), any());
    }

    private static PodcastImportService.PreviewEpisode episode(String guid, Long existingId) {
        return new PodcastImportService.PreviewEpisode(
                guid,
                "Title " + guid,
                "Notes",
                Instant.parse("2026-07-20T12:00:00Z"),
                3600,
                1,
                "https://cdn.example.com/" + guid + ".mp3",
                "audio/mpeg",
                1234L,
                null,
                guid,
                existingId
        );
    }
}
